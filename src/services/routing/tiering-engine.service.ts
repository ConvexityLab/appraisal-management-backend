import { Appraiser } from '../../types/appraiser.types.js';
import { LegacyManagementOrder } from '../../types/order-management.js';
import { ExclusionTier } from '../../types/routing.types.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('TieringEngineService');

export class TieringEngineService {
  /**
   * Determine the exact hierarchy tier for a vendor against a specific order.
   */
  public async getVendorTier(appraiser: Appraiser, order: LegacyManagementOrder): Promise<ExclusionTier> {
    logger.info(`Evaluating vendor tier for Appraiser ${appraiser.id} on Order ${order.id}`);

    // 1. Check DNU (Do Not Use) / Exclusion Lists
    const isDNU = await this.checkExclusionList(appraiser.id, (order.tenantId || 'default'), order.clientInformation?.clientId);
    if (isDNU) return 'DNU_DO_NOT_USE';

    // 2. Check Client Preferred Status
    const isClientPreferred = await this.checkPreferredList(appraiser.id, order.clientInformation?.clientId);
    if (isClientPreferred) return 'CLIENT_PREFERRED';

    // 3. Check Platform Preferred Status
    const isPlatformPreferred = await this.checkPlatformPreferred(appraiser.id, (order.tenantId || 'default'));
    if (isPlatformPreferred) return 'PLATFORM_PREFERRED';

    // 4. Default to General Pool
    return 'GENERAL_POOL';
  }

  private async checkExclusionList(appraiserId: string, tenantId: string, clientId?: string): Promise<boolean> {
    // TODO: Hook into actual `ExclusionListEntry` DB checks
    return false; // Mocking false
  }

  private async checkPreferredList(appraiserId: string, clientId?: string): Promise<boolean> {
    if (!clientId) return false;
    // TODO: Hook into client_preferred_vendors DB table
    return false;
  }

  private async checkPlatformPreferred(appraiserId: string, tenantId: string): Promise<boolean> {
    // TODO: Check platform level tags
    return true; // Mocking true as a default high-performer
  }
}
