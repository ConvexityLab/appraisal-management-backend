import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters, 
  PropertyDetails, 
  PropertyAddress, 
  PropertyType,
  PropertyCondition,
  OrderStatus,
  Priority,
  ProductType,
  OrderType,
  VendorStatus,
  OccupancyType,
  ViewType,
  ConstructionType
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Enhanced Database Service with improved mock data and relationships
 */
export class EnhancedDatabaseService {
  private logger: Logger;
  private orders: Map<string, AppraisalOrder>;
  private vendors: Map<string, Vendor>;
  private properties: Map<string, any>;
  private relationships: Map<string, string[]>; // Track relationships between entities

  constructor() {
    this.logger = new Logger();
    this.orders = new Map();
    this.vendors = new Map();
    this.properties = new Map();
    this.relationships = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  // ===============================
  // Order Operations
  // ===============================

  async createOrder(order: AppraisalOrder): Promise<AppraisalOrder> {
    this.orders.set(order.id, order);
    
    // Track relationships
    if (order.assignedVendorId) {
      this.addRelationship('vendor-orders', order.assignedVendorId, order.id);
    }
    
    this.logger.info('Order created in database', { orderId: order.id });
    return order;
  }

  async findOrderById(id: string): Promise<AppraisalOrder | null> {
    return this.orders.get(id) || null;
  }

  async findOrders(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: AppraisalOrder[]; total: number }> {
    let allOrders = Array.from(this.orders.values());
    
    // Apply filters
    if (filters.status && filters.status.length > 0) {
      allOrders = allOrders.filter(order => filters.status!.includes(order.status));
    }
    if (filters.priority && filters.priority.length > 0) {
      allOrders = allOrders.filter(order => filters.priority!.includes(order.priority));
    }
    if (filters.productType && filters.productType.length > 0) {
      allOrders = allOrders.filter(order => filters.productType!.includes(order.productType));
    }
    if (filters.assignedVendorId) {
      allOrders = allOrders.filter(order => order.assignedVendorId === filters.assignedVendorId);
    }
    if (filters.createdFrom || filters.createdTo) {
      allOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        if (filters.createdFrom && orderDate < filters.createdFrom) return false;
        if (filters.createdTo && orderDate > filters.createdTo) return false;
        return true;
      });
    }

    // Sort by creation date (newest first)
    allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = allOrders.length;
    const orders = allOrders.slice(offset, offset + limit);

    return { orders, total };
  }

  async updateOrder(id: string, order: AppraisalOrder): Promise<AppraisalOrder> {
    const existing = this.orders.get(id);
    if (!existing) {
      throw new Error(`Order not found: ${id}`);
    }

    // Update relationships if vendor assignment changed
    if (existing.assignedVendorId !== order.assignedVendorId) {
      if (existing.assignedVendorId) {
        this.removeRelationship('vendor-orders', existing.assignedVendorId, id);
      }
      if (order.assignedVendorId) {
        this.addRelationship('vendor-orders', order.assignedVendorId, id);
      }
    }

    this.orders.set(id, order);
    this.logger.info('Order updated in database', { orderId: id });
    return order;
  }

  async deleteOrder(id: string): Promise<void> {
    const order = this.orders.get(id);
    if (order && order.assignedVendorId) {
      this.removeRelationship('vendor-orders', order.assignedVendorId, id);
    }
    this.orders.delete(id);
    this.logger.info('Order deleted from database', { orderId: id });
  }

  // ===============================
  // Vendor Operations
  // ===============================

  async createVendor(vendor: Vendor): Promise<Vendor> {
    this.vendors.set(vendor.id, vendor);
    this.logger.info('Vendor created in database', { vendorId: vendor.id });
    return vendor;
  }

  async findVendorById(id: string): Promise<Vendor | null> {
    return this.vendors.get(id) || null;
  }

  async findVendors(filters: any, offset: number, limit: number): Promise<{ vendors: Vendor[]; total: number }> {
    let allVendors = Array.from(this.vendors.values());

    // Apply filters
    if (filters.status) {
      allVendors = allVendors.filter(vendor => vendor.status === filters.status);
    }
    if (filters.licenseState) {
      allVendors = allVendors.filter(vendor => vendor.licenseState === filters.licenseState);
    }
    if (filters.productTypes && filters.productTypes.length > 0) {
      allVendors = allVendors.filter(vendor => 
        filters.productTypes.some((pt: ProductType) => vendor.productTypes.includes(pt))
      );
    }
    if (filters.name) {
      const nameRegex = new RegExp(filters.name, 'i');
      allVendors = allVendors.filter(vendor => nameRegex.test(vendor.name));
    }

    // Sort by quality score (highest first)
    allVendors.sort((a, b) => (b.performance.qualityScore || 0) - (a.performance.qualityScore || 0));

    const total = allVendors.length;
    const vendors = allVendors.slice(offset, offset + limit);

    return { vendors, total };
  }

  async updateVendor(id: string, vendor: Vendor): Promise<Vendor> {
    if (!this.vendors.has(id)) {
      throw new Error(`Vendor not found: ${id}`);
    }
    this.vendors.set(id, vendor);
    this.logger.info('Vendor updated in database', { vendorId: id });
    return vendor;
  }

  async deleteVendor(id: string): Promise<void> {
    // Check for active order assignments
    const vendorOrders = this.getRelationships('vendor-orders', id);
    if (vendorOrders.length > 0) {
      throw new Error(`Cannot delete vendor with active orders: ${vendorOrders.length} orders assigned`);
    }
    
    this.vendors.delete(id);
    this.logger.info('Vendor deleted from database', { vendorId: id });
  }

  // ===============================
  // Property Operations
  // ===============================

  async createProperty(property: any): Promise<any> {
    this.properties.set(property.id, property);
    
    // Create reverse geocoding index for better geographic searches
    this.addToGeographicIndex(property);
    
    this.logger.info('Property created in database', { propertyId: property.id });
    return property;
  }

  async findPropertyById(id: string): Promise<any | null> {
    return this.properties.get(id) || null;
  }

  async findProperties(filters: any, offset: number, limit: number): Promise<{ properties: any[]; total: number }> {
    let allProperties = Array.from(this.properties.values());

    // Apply comprehensive filters
    allProperties = this.applyPropertyFilters(allProperties, filters);

    // Sort properties
    allProperties = this.sortProperties(allProperties, filters.sort);

    const total = allProperties.length;
    const properties = allProperties.slice(offset, offset + limit);

    return { properties, total };
  }

  async updateProperty(id: string, property: any): Promise<any> {
    if (!this.properties.has(id)) {
      throw new Error(`Property not found: ${id}`);
    }
    
    this.properties.set(id, property);
    this.addToGeographicIndex(property); // Update geographic index
    
    this.logger.info('Property updated in database', { propertyId: id });
    return property;
  }

  async deleteProperty(id: string): Promise<void> {
    this.properties.delete(id);
    this.logger.info('Property deleted from database', { propertyId: id });
  }

  async countProperties(filters: any): Promise<number> {
    let allProperties = Array.from(this.properties.values());
    allProperties = this.applyPropertyFilters(allProperties, filters);
    return allProperties.length;
  }

  // ===============================
  // Advanced Query Operations
  // ===============================

  /**
   * Get orders by vendor with performance metrics
   */
  async getOrdersByVendor(vendorId: string): Promise<{
    orders: AppraisalOrder[];
    metrics: {
      totalOrders: number;
      completedOrders: number;
      averageTurnaroundTime: number;
      onTimeDeliveryRate: number;
    };
  }> {
    const orderIds = this.getRelationships('vendor-orders', vendorId);
    const orders = orderIds.map(id => this.orders.get(id)).filter(Boolean) as AppraisalOrder[];
    
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);
    const totalOrders = orders.length;
    
    // Calculate metrics
    let totalTurnaroundTime = 0;
    let onTimeCount = 0;
    
    completedOrders.forEach(order => {
      const turnaround = new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime();
      totalTurnaroundTime += turnaround;
      
      // Check if delivered on time (simplified)
      const dueDate = new Date(order.dueDate).getTime();
      const completedDate = new Date(order.updatedAt).getTime();
      if (completedDate <= dueDate) {
        onTimeCount++;
      }
    });

    const averageTurnaroundTime = completedOrders.length > 0 ? 
      totalTurnaroundTime / completedOrders.length / (1000 * 60 * 60 * 24) : 0; // in days

    const onTimeDeliveryRate = totalOrders > 0 ? (onTimeCount / totalOrders) * 100 : 0;

    return {
      orders,
      metrics: {
        totalOrders,
        completedOrders: completedOrders.length,
        averageTurnaroundTime,
        onTimeDeliveryRate
      }
    };
  }

  /**
   * Get comprehensive statistics
   */
  async getSystemStatistics(): Promise<{
    orders: { total: number; byStatus: Record<string, number> };
    vendors: { total: number; active: number; byState: Record<string, number> };
    properties: { total: number; byType: Record<string, number> };
  }> {
    // Order statistics
    const allOrders = Array.from(this.orders.values());
    const ordersByStatus: Record<string, number> = {};
    Object.values(OrderStatus).forEach(status => {
      ordersByStatus[status] = allOrders.filter(o => o.status === status).length;
    });

    // Vendor statistics
    const allVendors = Array.from(this.vendors.values());
    const activeVendors = allVendors.filter(v => v.status === VendorStatus.ACTIVE).length;
    const vendorsByState: Record<string, number> = {};
    allVendors.forEach(vendor => {
      vendorsByState[vendor.licenseState] = (vendorsByState[vendor.licenseState] || 0) + 1;
    });

    // Property statistics
    const allProperties = Array.from(this.properties.values());
    const propertiesByType: Record<string, number> = {};
    Object.values(PropertyType).forEach(type => {
      propertiesByType[type] = allProperties.filter(p => p.details.propertyType === type).length;
    });

    return {
      orders: {
        total: allOrders.length,
        byStatus: ordersByStatus
      },
      vendors: {
        total: allVendors.length,
        active: activeVendors,
        byState: vendorsByState
      },
      properties: {
        total: allProperties.length,
        byType: propertiesByType
      }
    };
  }

  // ===============================
  // Helper Methods
  // ===============================

  private applyPropertyFilters(properties: any[], filters: any): any[] {
    let filtered = properties;

    // Status filter
    if (filters.status) {
      if (filters.status.$ne) {
        filtered = filtered.filter(p => p.status !== filters.status.$ne);
      } else {
        filtered = filtered.filter(p => p.status === filters.status);
      }
    }

    // Property type filter
    if (filters['details.propertyType']) {
      filtered = filtered.filter(p => p.details.propertyType === filters['details.propertyType']);
    }

    // City filter (case insensitive)
    if (filters['address.city']) {
      if (filters['address.city'].$regex) {
        const regex = new RegExp(filters['address.city'].$regex, filters['address.city'].$options || '');
        filtered = filtered.filter(p => regex.test(p.address.city));
      } else {
        filtered = filtered.filter(p => 
          p.address.city.toLowerCase().includes(filters['address.city'].toLowerCase())
        );
      }
    }

    // State filter
    if (filters['address.state']) {
      filtered = filtered.filter(p => p.address.state === filters['address.state']);
    }

    // ZIP code filter
    if (filters['address.zipCode']) {
      filtered = filtered.filter(p => p.address.zipCode === filters['address.zipCode']);
    }

    // Year built range
    if (filters['details.yearBuilt']) {
      if (filters['details.yearBuilt'].$gte) {
        filtered = filtered.filter(p => (p.details.yearBuilt || 0) >= filters['details.yearBuilt'].$gte);
      }
      if (filters['details.yearBuilt'].$lte) {
        filtered = filtered.filter(p => (p.details.yearBuilt || 0) <= filters['details.yearBuilt'].$lte);
      }
    }

    // Square footage range
    if (filters['details.grossLivingArea']) {
      if (filters['details.grossLivingArea'].$gte) {
        filtered = filtered.filter(p => (p.details.grossLivingArea || 0) >= filters['details.grossLivingArea'].$gte);
      }
      if (filters['details.grossLivingArea'].$lte) {
        filtered = filtered.filter(p => (p.details.grossLivingArea || 0) <= filters['details.grossLivingArea'].$lte);
      }
    }

    // Bedroom count
    if (filters['details.bedrooms']) {
      filtered = filtered.filter(p => p.details.bedrooms === filters['details.bedrooms']);
    }

    // Bathroom count  
    if (filters['details.bathrooms']) {
      filtered = filtered.filter(p => p.details.bathrooms === filters['details.bathrooms']);
    }

    // Features filter
    if (filters['details.features'] && filters['details.features'].$in) {
      filtered = filtered.filter(p => 
        filters['details.features'].$in.some((feature: string) => 
          p.details.features.includes(feature)
        )
      );
    }

    // Geographic filters (simplified)
    if (filters.coordinates) {
      if (filters.coordinates.latitude && filters.coordinates.longitude) {
        const { latitude, longitude } = filters.coordinates;
        filtered = filtered.filter(p => {
          if (!p.coordinates) return false;
          const latDiff = Math.abs(p.coordinates.latitude - latitude.latitude);
          const lngDiff = Math.abs(p.coordinates.longitude - longitude.longitude);
          return latDiff <= 0.1 && lngDiff <= 0.1; // Rough proximity filter
        });
      }
    }

    return filtered;
  }

  private sortProperties(properties: any[], sortOptions?: any): any[] {
    if (!sortOptions) {
      // Default sort by updated date
      return properties.sort((a, b) => 
        new Date(b.metadata?.updatedAt || 0).getTime() - new Date(a.metadata?.updatedAt || 0).getTime()
      );
    }

    return properties.sort((a, b) => {
      for (const [field, direction] of Object.entries(sortOptions)) {
        const aVal = this.getNestedValue(a, field);
        const bVal = this.getNestedValue(b, field);
        
        if (aVal < bVal) return direction === -1 ? 1 : -1;
        if (aVal > bVal) return direction === -1 ? -1 : 1;
      }
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  private addRelationship(type: string, parentId: string, childId: string): void {
    const key = `${type}:${parentId}`;
    if (!this.relationships.has(key)) {
      this.relationships.set(key, []);
    }
    const relationships = this.relationships.get(key)!;
    if (!relationships.includes(childId)) {
      relationships.push(childId);
    }
  }

  private removeRelationship(type: string, parentId: string, childId: string): void {
    const key = `${type}:${parentId}`;
    const relationships = this.relationships.get(key);
    if (relationships) {
      const index = relationships.indexOf(childId);
      if (index > -1) {
        relationships.splice(index, 1);
      }
    }
  }

  private getRelationships(type: string, parentId: string): string[] {
    const key = `${type}:${parentId}`;
    return this.relationships.get(key) || [];
  }

  private addToGeographicIndex(property: any): void {
    // Simplified geographic indexing for better search performance
    if (property.coordinates) {
      const { latitude, longitude } = property.coordinates;
      const geoKey = `geo:${Math.floor(latitude * 10)}:${Math.floor(longitude * 10)}`;
      this.addRelationship('geographic-index', geoKey, property.id);
    }
  }

  private initializeSampleData(): void {
    this.logger.info('Initializing enhanced database with sample data');

    // Sample vendors
    const sampleVendors: Vendor[] = [
      {
        id: 'vendor-001',
        name: 'Apex Appraisal Services',
        email: 'contact@apexappraisal.com',
        phone: '555-0101',
        licenseNumber: 'CA-12345',
        licenseState: 'CA',
        licenseExpiry: new Date('2025-12-31'),
        onboardingDate: new Date('2024-01-15'),
        lastActive: new Date('2024-12-15'),
        certifications: [],
        serviceAreas: [],
        productTypes: [ProductType.FULL_APPRAISAL, ProductType.DESKTOP_APPRAISAL],
        specialties: [],
        performance: {
          totalOrders: 150,
          completedOrders: 145,
          averageTurnTime: 76.8, // 3.2 days * 24 hours
          revisionRate: 3.3,
          onTimeDeliveryRate: 96.7,
          qualityScore: 4.9,
          clientSatisfactionScore: 4.7,
          lastUpdated: new Date()
        },
        status: VendorStatus.ACTIVE,
        // bankingInfo: { // TODO: Property doesn't exist on Vendor type
        //   accountName: 'Apex Appraisal Services',
        //   routingNumber: '123456789',
        //   accountNumber: '987654321'
        // },
        insuranceInfo: {
          provider: 'Professional Insurance Co',
          policyNumber: 'POL-123456',
          coverage: 1000000,
          expiryDate: new Date('2025-06-30'),
          status: 'active'
        },
        paymentInfo: {
          method: 'ach',
          bankName: 'First National Bank',
          accountNumber: '987654321',
          routingNumber: '123456789'
        },
        preferences: {
          orderTypes: [OrderType.PURCHASE, OrderType.REFINANCE],
          productTypes: [ProductType.FULL_APPRAISAL],
          maxOrdersPerDay: 5,
          workingHours: { start: '08:00', end: '17:00' },
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          notificationPreferences: {
            email: true,
            sms: false,
            portal: true
          }
        },
        // createdAt: new Date('2024-01-15'), // TODO: Property doesn't exist on Vendor type
        // updatedAt: new Date('2024-12-15'), // TODO: Property doesn't exist on Vendor type
        // createdBy: 'system', // TODO: Property doesn't exist on Vendor type
        // tags: ['reliable', 'fast-turnaround'], // TODO: Property doesn't exist on Vendor type
        // metadata: {} // TODO: Property doesn't exist on Vendor type
      }
    ];

    // Sample properties
    const sampleProperties = [
      {
        id: 'prop-001',
        address: {
          streetAddress: '123 Oak Street',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          county: 'San Francisco',
          coordinates: { latitude: 37.7749, longitude: -122.4194 }
        },
        details: {
          propertyType: PropertyType.SFR,
          occupancy: OccupancyType.OWNER_OCCUPIED,
          yearBuilt: 2018,
          grossLivingArea: 2400,
          lotSize: 6000,
          bedrooms: 4,
          bathrooms: 3,
          stories: 2,
          garage: true,
          pool: false,
          features: ['hardwood floors', 'granite counters', 'updated kitchen'],
          condition: PropertyCondition.EXCELLENT,
          viewType: ViewType.CITY,
          constructionType: ConstructionType.FRAME
        },
        metadata: {
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-12-10'),
          version: 1,
          dataSource: 'manual_entry',
          validationStatus: 'validated'
        },
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        marketData: {
          estimatedValue: 850000,
          pricePerSqFt: 354,
          marketTrend: 'stable',
          daysOnMarket: 25,
          lastUpdated: new Date()
        },
        riskFactors: {
          overallRisk: 'low',
          factors: { age: 'low', condition: 'low', location: 'low', market: 'low' },
          score: 15,
          lastAssessed: new Date()
        },
        status: 'active'
      }
    ];

    // Sample orders  
    const firstProperty = sampleProperties[0];
    if (!firstProperty) {
      throw new Error('Sample property required for orders');
    }
    
    const sampleOrders: AppraisalOrder[] = [
      {
        id: 'order-001',
        clientId: 'client-001',
        orderNumber: 'APR-2024-001',
        propertyAddress: firstProperty.address,
        propertyDetails: firstProperty.details,
        orderType: OrderType.PURCHASE,
        productType: ProductType.FULL_APPRAISAL,
        dueDate: new Date('2025-01-20'),
        rushOrder: false,
        borrowerInformation: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@email.com',
          phone: '555-1234'
        },
        loanInformation: {
          loanAmount: 680000,
          loanType: 'Conventional' as any,
          loanPurpose: 'Purchase' as any,
          contractPrice: 850000
        },
        contactInformation: {
          name: 'Sarah Johnson',
          role: 'loan_officer' as any,
          email: 'sarah.j@lender.com',
          phone: '555-5678',
          preferredMethod: 'email' as any
        },
        status: OrderStatus.NEW,
        priority: Priority.NORMAL,
        assignedVendorId: 'vendor-001',
        createdAt: new Date('2024-12-15'),
        updatedAt: new Date('2024-12-15'),
        createdBy: 'system',
        tags: ['new-client'],
        metadata: {}
      }
    ];

    // Load sample data
    sampleVendors.forEach(vendor => this.vendors.set(vendor.id, vendor));
    sampleProperties.forEach(property => this.properties.set(property.id, property));
    sampleOrders.forEach(order => {
      this.orders.set(order.id, order);
      if (order.assignedVendorId) {
        this.addRelationship('vendor-orders', order.assignedVendorId, order.id);
      }
    });

    this.logger.info('Sample data loaded', {
      vendors: this.vendors.size,
      properties: this.properties.size,
      orders: this.orders.size
    });
  }
}

// Export the enhanced service
export { EnhancedDatabaseService as DatabaseService };