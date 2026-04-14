// Entra ID Extension Attributes & Claims Configuration
//
// Configures the backend app registration to emit `clientId` and `subClientId`
// as first-class JWT claims so the platform can scope data access without a
// separate directory lookup on every request.
//
// WHAT THIS MODULE DOES (in one deploymentScript run):
//   1. Registers `clientId` and `subClientId` as directory extension properties
//      on the app registration (extension_<appId_noDashes>_clientId etc.)
//   2. Sets acceptMappedClaims = true on the app (required for custom mapping)
//   3. Creates/updates a ClaimsMappingPolicy that maps the extension attributes
//      to short claim names ("clientId", "subClientId") in access tokens
//   4. Assigns the policy to our service principal
//
// WHAT THIS MODULE DOES NOT DO:
//   - Assign per-user values for clientId/subClientId — that is an operational
//     step handled by scripts/set-user-identity.ts or Admin API.
//
// IDENTITY REQUIREMENTS (deploying managed identity must have):
//   Application.ReadWrite.All
//   Policy.ReadWrite.ApplicationConfiguration
//   AppRoleAssignment.ReadWrite.All (for policy assignment)
//
// NOTE: The Microsoft.Graph Bicep extension (enabled via bicepconfig.json) is
//   available for future use.  Extension property registration and claims mapping
//   policy creation are not yet supported by it, so this module uses a
//   deploymentScript (ARM-hosted PowerShell) instead.

@description('Azure AD tenant ID (home tenant of our app registration)')
param tenantId string

@description('Client ID / Application ID of our backend app registration')
param appClientId string

@description('Object ID of the service principal for our app registration')
param servicePrincipalObjectId string

@description('Environment name for resource naming')
param environment string

@description('Azure region for the deployment script resource')
param location string

@description('Short suffix for resource name uniqueness')
param suffix string

param tags object

// ── Managed Identity ──────────────────────────────────────────────────────────
// The deployment script runs under this identity.
// Assign it Application.ReadWrite.All + Policy.ReadWrite.ApplicationConfiguration
// in Azure AD IAM before running deployments.
resource scriptIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-entra-setup-${environment}-${suffix}'
  location: location
  tags: tags
}

// ── Deployment Script ─────────────────────────────────────────────────────────
// Idempotent: safe to re-run on every deployment.
resource entraExtensionSetup 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'script-entra-extension-${environment}-${suffix}'
  location: location
  tags: tags
  kind: 'AzurePowerShell'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${scriptIdentity.id}': {}
    }
  }
  properties: {
    azPowerShellVersion: '11.0'
    retentionInterval: 'P1D'
    timeout: 'PT15M'
    cleanupPreference: 'OnSuccess'
    environmentVariables: [
      { name: 'TENANT_ID',                   value: tenantId }
      { name: 'APP_CLIENT_ID',               value: appClientId }
      { name: 'SERVICE_PRINCIPAL_OBJECT_ID', value: servicePrincipalObjectId }
    ]
    scriptContent: '''
      Set-StrictMode -Version Latest
      $ErrorActionPreference = 'Stop'

      # ── Install Graph SDK (first run only) ─────────────────────────────────
      $modules = @('Microsoft.Graph.Applications', 'Microsoft.Graph.Identity.SignIns')
      foreach ($mod in $modules) {
        if (-not (Get-Module -ListAvailable -Name $mod)) {
          Install-Module $mod -Force -Scope CurrentUser -Repository PSGallery
        }
        Import-Module $mod
      }

      Connect-MgGraph -Identity -TenantId $env:TENANT_ID -NoWelcome

      $appClientId = $env:APP_CLIENT_ID
      $spObjectId  = $env:SERVICE_PRINCIPAL_OBJECT_ID

      # ── Step 1: Locate the app registration ───────────────────────────────
      $app = Get-MgApplication -Filter "appId eq '$appClientId'"
      if (-not $app) {
        throw "App registration not found for appId=$appClientId"
      }
      Write-Host "Found app: $($app.DisplayName) ($($app.Id))"

      # ── Step 1b: Register App Roles ───────────────────────────────────────
      # Role IDs are STABLE GUIDs — do NOT change them after first deployment.
      # Existing user app role assignments reference them by ID; changing IDs
      # would silently break all role assignments.
      $desiredAppRoles = @(
        @{ Id = '00000001-0000-0000-0000-000000000001'; DisplayName = 'Administrator'; Value = 'Admin';     Description = 'Full platform access';                 AllowedMemberTypes = @('User'); IsEnabled = $true },
        @{ Id = '00000001-0000-0000-0000-000000000002'; DisplayName = 'Manager';       Value = 'Manager';   Description = 'Order and vendor management';          AllowedMemberTypes = @('User'); IsEnabled = $true },
        @{ Id = '00000001-0000-0000-0000-000000000003'; DisplayName = 'QC Analyst';    Value = 'QCAnalyst'; Description = 'Quality control review and execution'; AllowedMemberTypes = @('User'); IsEnabled = $true },
        @{ Id = '00000001-0000-0000-0000-000000000004'; DisplayName = 'Appraiser';     Value = 'Appraiser'; Description = 'Order view and update access';         AllowedMemberTypes = @('User'); IsEnabled = $true }
      )
      $existingAppRoles = @($app.AppRoles)
      $newRoles = @()
      foreach ($desired in $desiredAppRoles) {
        $match = $existingAppRoles | Where-Object { $_.Id.ToString() -eq $desired.Id -or $_.Value -eq $desired.Value }
        if (-not $match) { $newRoles += $desired; Write-Host "Queuing App Role: $($desired.Value)" }
        else              { Write-Host "App Role already exists: $($desired.Value)" }
      }
      if ($newRoles.Count -gt 0) {
        $merged = [System.Collections.ArrayList]::new()
        $existingAppRoles | ForEach-Object { [void]$merged.Add($_) }
        $newRoles         | ForEach-Object { [void]$merged.Add($_) }
        Update-MgApplication -ApplicationId $app.Id -AppRoles $merged
        Write-Host "Registered $($newRoles.Count) new App Role(s)"
      }

      # ── Step 2: Register extension properties ──────────────────────────────
      # Produces: extension_<appId_noDashes>_clientId and _subClientId
      foreach ($attrName in @('clientId', 'subClientId')) {
        $existing = Get-MgApplicationExtensionProperty -ApplicationId $app.Id |
                    Where-Object { $_.Name -match $attrName }
        if (-not $existing) {
          $params = @{
            Name          = $attrName
            DataType      = 'String'
            TargetObjects = @('User')
          }
          New-MgApplicationExtensionProperty -ApplicationId $app.Id -BodyParameter $params
          Write-Host "Registered extension property: $attrName"
        } else {
          Write-Host "Extension property already exists: $attrName"
        }
      }

      # ── Step 3: Enable acceptMappedClaims on the app ───────────────────────
      # Required for claims mapping policies to take effect.
      Update-MgApplication -ApplicationId $app.Id -Api @{ AcceptMappedClaims = $true }
      Write-Host "Set acceptMappedClaims = true on app registration"

      # ── Step 4: Create/update the ClaimsMappingPolicy ─────────────────────
      # Maps the full extension attribute names to short token claim names.
      $policyName     = 'ClientIdentityClaimsPolicy'
      $appIdNoDashes  = $appClientId -replace '-', ''

      $claimsSchema = @(
        @{
          Source       = 'user'
          ExtensionID  = "extension_${appIdNoDashes}_clientId"
          JwtClaimType = 'clientId'
        },
        @{
          Source       = 'user'
          ExtensionID  = "extension_${appIdNoDashes}_subClientId"
          JwtClaimType = 'subClientId'
        }
      )

      $policyDef = (@{
        ClaimsMappingPolicy = @{
          Version              = 1
          IncludeBasicClaimSet = $true
          ClaimsSchema         = $claimsSchema
        }
      } | ConvertTo-Json -Depth 10 -Compress)

      $existingPolicy = Get-MgPolicyClaimMappingPolicy -Filter "displayName eq '$policyName'" `
                          -ErrorAction SilentlyContinue
      if ($existingPolicy) {
        Update-MgPolicyClaimMappingPolicy -ClaimsMappingPolicyId $existingPolicy.Id `
          -Definition @($policyDef) -DisplayName $policyName
        $policyId = $existingPolicy.Id
        Write-Host "Updated ClaimsMappingPolicy: $policyName ($policyId)"
      } else {
        $newPolicy = New-MgPolicyClaimMappingPolicy `
          -Definition @($policyDef) `
          -DisplayName $policyName `
          -IsOrganizationDefault $false
        $policyId = $newPolicy.Id
        Write-Host "Created ClaimsMappingPolicy: $policyName ($policyId)"
      }

      # ── Step 5: Assign policy to the service principal ────────────────────
      $assigned = Get-MgServicePrincipalClaimMappingPolicy `
                    -ServicePrincipalId $spObjectId -ErrorAction SilentlyContinue |
                  Where-Object { $_.Id -eq $policyId }

      if (-not $assigned) {
        $ref = @{
          '@odata.id' = "https://graph.microsoft.com/v1.0/policies/claimsMappingPolicies/$policyId"
        }
        New-MgServicePrincipalClaimMappingPolicyByRef `
          -ServicePrincipalId $spObjectId -BodyParameter $ref
        Write-Host "Assigned ClaimsMappingPolicy to service principal"
      } else {
        Write-Host "ClaimsMappingPolicy already assigned to service principal"
      }

      Write-Host "Extension attribute and claims configuration complete."
      $DeploymentScriptOutputs = @{
        policyId             = $policyId
        appIdNoDashes        = $appIdNoDashes
        clientIdExtension    = "extension_${appIdNoDashes}_clientId"
        subClientIdExtension = "extension_${appIdNoDashes}_subClientId"
      }
    '''
  }
}

// ── Per-User Identity Assignment ──────────────────────────────────────────────
// Setting extension attribute values on individual users is an OPERATIONAL step,
// not a Bicep concern.  Use scripts/set-user-identity.ts:
//
//   npx tsx scripts/set-user-identity.ts \
//     --user <objectId> \
//     --clientId lender-abc \
//     --subClientId lender-abc-retail
//
// For test/dev: values are embedded in JWT via TestTokenGenerator
// (reads AXIOM_CLIENT_ID and AXIOM_SUB_CLIENT_ID from environment).

output scriptIdentityClientId  string = scriptIdentity.properties.clientId
output scriptIdentityObjectId   string = scriptIdentity.properties.principalId
output clientIdExtensionName    string = 'extension_${replace(appClientId, '-', '')}_clientId'
output subClientIdExtensionName string = 'extension_${replace(appClientId, '-', '')}_subClientId'
