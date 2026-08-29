// Lagringskonto for Familiehistorie.
//
// Static Web App opprettes ikke her, men med `az staticwebapp create` i
// opprett.sh – da settes GitHub-koblingen og arbeidsflyten opp i samme
// operasjon, noe som er vesentlig enklere enn å gjøre det i Bicep.

@description('Prefiks for ressursnavn. Lagringskontonavnet blir <prefiks>lager og må bli maks 24 tegn, kun små bokstaver og tall.')
@minLength(3)
@maxLength(17)
param prefiks string

@description('Region. Lagring og Static Web App trenger ikke ligge i samme region.')
param sted string = resourceGroup().location

@description('Opphav nettleseren laster opp media fra. Static Web App-adressen, og et eventuelt eget domene.')
param tillatteOpphav array = []

@description('Antall dager slettede blober kan gjenopprettes.')
@minValue(1)
@maxValue(365)
param angredager int = 30

var lagernavn = toLower('${prefiks}lager')

resource lager 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: lagernavn
  location: sted
  sku: {
    // LRS holder når blob-versjonering og en kopi utenfor Azure er på plass.
    // Bytt til Standard_GRS hvis materialet oppleves som uerstattelig.
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    // Ingen anonym lesetilgang. Alt innhold hentes med kortlevd SAS fra API-et.
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
  }
}

resource blobtjeneste 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: lager
  name: 'default'
  properties: {
    // Nettleseren laster opp media direkte til Blob, utenom API-et. Uten
    // CORS-regler blokkerer den kallet før det sendes, og SAS-en er irrelevant.
    // Hodene under er de opplastingen faktisk sender – se
    // app/src/media/opplasting.ts.
    cors: {
      corsRules: empty(tillatteOpphav) ? [] : [
        {
          allowedOrigins: tillatteOpphav
          allowedMethods: ['GET', 'HEAD', 'PUT', 'OPTIONS']
          allowedHeaders: ['x-ms-blob-type', 'x-ms-blob-content-type', 'x-ms-version', 'content-type']
          exposedHeaders: ['ETag', 'x-ms-request-id']
          maxAgeInSeconds: 3600
        }
      ]
    }
    // Versjonering gir angrerett på feilredigering uten at appen må bygge
    // versjonshistorikk selv.
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: angredager
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: angredager
    }
  }
}

resource innhold 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobtjeneste
  name: 'innhold'
  properties: {
    publicAccess: 'None'
  }
}

resource media 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobtjeneste
  name: 'media'
  properties: {
    publicAccess: 'None'
  }
}

resource originaler 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobtjeneste
  name: 'originaler'
  properties: {
    publicAccess: 'None'
  }
}

resource tabelltjeneste 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: lager
  name: 'default'
}

// Brukes først i trinn 9 (engangskoder og rate-limiting), men opprettes nå så
// kontoen er ferdig oppsatt.
resource otpkoder 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tabelltjeneste
  name: 'otpkoder'
}

// Livssyklus.
//
// Merk at prefixMatch treffer stier, ikke filendelser. Bildeoriginaler ligger
// derfor i sin egen container: en regel som arkiverte «alt under media/» ville
// tatt web-versjonene og videoen appen faktisk serverer, og Archive-nivået må
// rehydreres i timevis før det kan leses.
resource livslop 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: lager
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'originaler-til-archive'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['originaler/']
            }
            actions: {
              baseBlob: {
                tierToArchive: {
                  daysAfterCreationGreaterThan: 1
                }
              }
            }
          }
        }
        {
          name: 'gamle-versjoner-til-cool'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
            }
            actions: {
              version: {
                tierToCool: {
                  daysAfterCreationGreaterThan: 30
                }
              }
            }
          }
        }
      ]
    }
  }
}

output lagernavn string = lager.name
output innholdContainer string = innhold.name
output mediaContainer string = media.name
output originalerContainer string = originaler.name
