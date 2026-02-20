import { AppraisalOrder, Vendor, OrderFilters, PropertyDetails, PropertyAddress } from '../types/index.js';

export interface DatabaseOrderRepository {
  create(order: AppraisalOrder): Promise<AppraisalOrder>;
  findById(id: string): Promise<AppraisalOrder | null>;
  findMany(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: AppraisalOrder[]; total: number }>;
  update(id: string, order: AppraisalOrder): Promise<AppraisalOrder>;
  delete(id: string): Promise<void>;
}

export interface DatabaseVendorRepository {
  create(vendor: Vendor): Promise<Vendor>;
  findById(id: string): Promise<Vendor | null>;
  findMany(filters: any, offset: number, limit: number): Promise<{ vendors: Vendor[]; total: number }>;
  update(id: string, vendor: Vendor): Promise<Vendor>;
  delete(id: string): Promise<void>;
}

export interface PropertyRecord {
  id: string;
  address: PropertyAddress;
  details: PropertyDetails;
  metadata?: Record<string, any>;
  searchableFields?: string[];
  coordinates?: { latitude: number; longitude: number };
  marketData?: any;
  riskFactors?: any;
  valuationHistory?: any[];
  auditTrail?: any[];
  status?: string;
}

export interface DatabasePropertyRepository {
  create(property: PropertyRecord): Promise<PropertyRecord>;
  findById(id: string): Promise<PropertyRecord | null>;
  findMany(filters: any, offset: number, limit: number): Promise<{ properties: PropertyRecord[]; total: number }>;
  update(id: string, property: PropertyRecord): Promise<PropertyRecord>;
  delete(id: string): Promise<void>;
  count(filters: any): Promise<number>;
}

export class DatabaseService {
  public orders: DatabaseOrderRepository;
  public vendors: DatabaseVendorRepository;
  public properties: DatabasePropertyRepository;

  constructor() {
    // These will be implemented with actual database connections
    this.orders = new MockOrderRepository();
    this.vendors = new MockVendorRepository();
    this.properties = new MockPropertyRepository();
  }
}

// Mock implementations for development
class MockOrderRepository implements DatabaseOrderRepository {
  private orders: Map<string, AppraisalOrder> = new Map();

  constructor() {
    // Seed with test data on initialization
    this.seedTestData();
  }

  private seedTestData(): void {
    // Seed order-005: Completed order with full workflow
    const order005: any = {
      id: 'order-005',
      orderNumber: 'APR-2026-005',
      clientId: 'client-002',
      status: 'completed' as any,
      propertyAddress: {
        streetAddress: '555 Cedar Ln',
        city: 'Frisco',
        state: 'TX',
        zipCode: '75034',
        county: 'Collin'
      },
      appraisalType: 'Full Appraisal' as any,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: 'normal' as any,
      vendorAssignment: {
        vendorId: 'vendor-005',
        assignedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 14.9 * 24 * 60 * 60 * 1000),
        assignedBy: 'test-user-admin',
        status: 'accepted' as any
      },
      reportSubmittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      reportUrl: 'blob://reports/order-005-report.pdf',
      qcApprovedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      qcApprovedBy: 'test-user-qc',
      deliveredAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
      finalValue: 625000,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
      tenantId: 'test-tenant-123',
      orderType: 'purchase' as any,
      productType: 'full_appraisal' as any,
      createdBy: 'test-user-admin'
    };
    this.orders.set(order005.id, order005);

    // Add a few more test orders for variety
    const order001: any = {
      id: 'order-001',
      orderNumber: 'APR-2026-001',
      clientId: 'client-001',

      status: 'vendor_assigned' as any,
      propertyAddress: {
        streetAddress: '123 Main St',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        county: 'Dallas'
      },

      appraisalType: 'Full Appraisal' as any,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      priority: 'normal' as any,
      vendorAssignment: {
        vendorId: 'vendor-001',
        assignedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        assignedBy: 'test-user-admin',
        status: 'pending' as any
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      tenantId: 'test-tenant-123',
      orderType: 'purchase' as any,
      productType: 'full_appraisal' as any,
      createdBy: 'test-user-admin'
    };
    this.orders.set(order001.id, order001);

    const order002: any = {
      id: 'order-002',
      orderNumber: 'APR-2026-002',
      clientId: 'client-002',
      status: 'inspection_scheduled' as any,
      propertyAddress: {
        streetAddress: '456 Oak Ave',
        city: 'Plano',
        state: 'TX',
        zipCode: '75074',
        county: 'Collin'
      },
      appraisalType: 'Full Appraisal' as any,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      priority: 'normal' as any,
      vendorAssignment: {
        vendorId: 'vendor-002',
        assignedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        assignedBy: 'test-user-admin',
        status: 'accepted' as any
      },
      inspectionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      tenantId: 'test-tenant-123',
      orderType: 'purchase' as any,
      productType: 'full_appraisal' as any,
      createdBy: 'test-user-admin'
    };
    this.orders.set(order002.id, order002);

    // Orders awaiting assignment (PENDING_ASSIGNMENT)
    const pendingOrders: any[] = [
      {
        id: 'order-pa-001',
        orderNumber: 'APR-2026-PA01',
        clientId: 'client-001',
        status: 'PENDING_ASSIGNMENT',
        propertyAddress: {
          street: '742 Evergreen Terrace',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          county: 'Denver'
        },
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'NORMAL',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      },
      {
        id: 'order-pa-002',
        orderNumber: 'APR-2026-PA02',
        clientId: 'client-002',
        status: 'PENDING_ASSIGNMENT',
        propertyAddress: {
          street: '1600 Pennsylvania Ave',
          city: 'Aurora',
          state: 'CO',
          zipCode: '80012',
          county: 'Arapahoe'
        },
        orderType: 'REFINANCE',
        productType: 'DESKTOP_APPRAISAL',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'RUSH',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      },
      {
        id: 'order-pa-003',
        orderNumber: 'APR-2026-PA03',
        clientId: 'client-003',
        status: 'PENDING_ASSIGNMENT',
        propertyAddress: {
          street: '221B Baker Street',
          city: 'Boulder',
          state: 'CO',
          zipCode: '80301',
          county: 'Boulder'
        },
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'EXPEDITED',
        createdAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      },
      {
        id: 'order-pa-004',
        orderNumber: 'APR-2026-PA04',
        clientId: 'client-001',
        status: 'PENDING_ASSIGNMENT',
        propertyAddress: {
          street: '350 Fifth Avenue',
          city: 'Lakewood',
          state: 'CO',
          zipCode: '80226',
          county: 'Jefferson'
        },
        orderType: 'PURCHASE',
        productType: 'HYBRID_APPRAISAL',
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'NORMAL',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      }
    ];

    // Already-assigned orders
    const assignedOrders: any[] = [
      {
        id: 'order-as-001',
        orderNumber: 'APR-2026-AS01',
        clientId: 'client-002',
        status: 'ASSIGNED',
        propertyAddress: {
          street: '100 Maple Drive',
          city: 'Fort Collins',
          state: 'CO',
          zipCode: '80521',
          county: 'Larimer'
        },
        orderType: 'REFINANCE',
        productType: 'FULL_APPRAISAL',
        dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'NORMAL',
        assignedVendorId: 'vendor-premier-appraisal',
        assignedVendorName: 'Premier Appraisal Group',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      },
      {
        id: 'order-as-002',
        orderNumber: 'APR-2026-AS02',
        clientId: 'client-003',
        status: 'ASSIGNED',
        propertyAddress: {
          street: '55 Aspen Way',
          city: 'Colorado Springs',
          state: 'CO',
          zipCode: '80903',
          county: 'El Paso'
        },
        orderType: 'PURCHASE',
        productType: 'FULL_APPRAISAL',
        dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'NORMAL',
        assignedVendorId: 'vendor-rocky-mountain',
        assignedVendorName: 'Rocky Mountain Valuations',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        tenantId: 'test-tenant-123',
        createdBy: 'admin-user-001'
      }
    ];

    for (const order of [...pendingOrders, ...assignedOrders]) {
      this.orders.set(order.id, order);
    }
  }

  async create(order: AppraisalOrder): Promise<AppraisalOrder> {
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<AppraisalOrder | null> {
    return this.orders.get(id) || null;
  }

  async findMany(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: AppraisalOrder[]; total: number }> {
    let filteredOrders = Array.from(this.orders.values());
    
    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      filteredOrders = filteredOrders.filter(order => filters.status!.includes(order.status));
    }
    
    // Apply clientId filter
    if (filters.clientId) {
      filteredOrders = filteredOrders.filter(order => order.clientId === filters.clientId);
    }
    
    // Apply productType filter
    if (filters.productType && filters.productType.length > 0) {
      filteredOrders = filteredOrders.filter(order => filters.productType!.includes(order.productType as any));
    }
    
    // Apply priority filter
    if (filters.priority && filters.priority.length > 0) {
      filteredOrders = filteredOrders.filter(order => filters.priority!.includes(order.priority));
    }
    
    // Apply assignedVendorId filter
    if (filters.assignedVendorId) {
      filteredOrders = filteredOrders.filter(order => 
        order.assignedVendorId === filters.assignedVendorId
      );
    }
    
    // Apply date range filters
    if (filters.dueDateFrom) {
      filteredOrders = filteredOrders.filter(order => 
        order.dueDate && new Date(order.dueDate) >= filters.dueDateFrom!
      );
    }
    if (filters.dueDateTo) {
      filteredOrders = filteredOrders.filter(order => 
        order.dueDate && new Date(order.dueDate) <= filters.dueDateTo!
      );
    }
    if (filters.createdFrom) {
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.createdAt) >= filters.createdFrom!
      );
    }
    if (filters.createdTo) {
      filteredOrders = filteredOrders.filter(order => 
        new Date(order.createdAt) <= filters.createdTo!
      );
    }
    
    const total = filteredOrders.length;
    const orders = filteredOrders.slice(offset, offset + limit);
    return { orders, total };
  }

  async update(id: string, order: AppraisalOrder): Promise<AppraisalOrder> {
    this.orders.set(id, order);
    return order;
  }

  async delete(id: string): Promise<void> {
    this.orders.delete(id);
  }
}

class MockVendorRepository implements DatabaseVendorRepository {
  private vendors: Map<string, Vendor> = new Map();

  async create(vendor: Vendor): Promise<Vendor> {
    this.vendors.set(vendor.id, vendor);
    return vendor;
  }

  async findById(id: string): Promise<Vendor | null> {
    return this.vendors.get(id) || null;
  }

  async findMany(filters: any, offset: number, limit: number): Promise<{ vendors: Vendor[]; total: number }> {
    const allVendors = Array.from(this.vendors.values());
    const total = allVendors.length;
    const vendors = allVendors.slice(offset, offset + limit);
    return { vendors, total };
  }

  async update(id: string, vendor: Vendor): Promise<Vendor> {
    this.vendors.set(id, vendor);
    return vendor;
  }

  async delete(id: string): Promise<void> {
    this.vendors.delete(id);
  }
}

class MockPropertyRepository implements DatabasePropertyRepository {
  private properties: Map<string, PropertyRecord> = new Map();

  async create(property: PropertyRecord): Promise<PropertyRecord> {
    this.properties.set(property.id, property);
    return property;
  }

  async findById(id: string): Promise<PropertyRecord | null> {
    return this.properties.get(id) || null;
  }

  async findMany(filters: any, offset: number, limit: number): Promise<{ properties: PropertyRecord[]; total: number }> {
    const allProperties = Array.from(this.properties.values());
    // Apply basic filters
    let filteredProperties = allProperties;
    
    // Filter by status
    if (filters.status && filters.status.$ne) {
      filteredProperties = filteredProperties.filter(p => p.status !== filters.status.$ne);
    }
    
    // Filter by property type
    if (filters['details.propertyType']) {
      filteredProperties = filteredProperties.filter(p => p.details.propertyType === filters['details.propertyType']);
    }
    
    // Filter by city (case insensitive)
    if (filters['address.city'] && filters['address.city'].$regex) {
      const cityRegex = new RegExp(filters['address.city'].$regex, filters['address.city'].$options || '');
      filteredProperties = filteredProperties.filter(p => cityRegex.test(p.address.city));
    }
    
    const total = filteredProperties.length;
    const properties = filteredProperties.slice(offset, offset + limit);
    return { properties, total };
  }

  async update(id: string, property: PropertyRecord): Promise<PropertyRecord> {
    this.properties.set(id, property);
    return property;
  }

  async delete(id: string): Promise<void> {
    this.properties.delete(id);
  }

  async count(filters: any): Promise<number> {
    const allProperties = Array.from(this.properties.values());
    let filteredProperties = allProperties;
    
    // Apply same filtering logic as findMany
    if (filters.status && filters.status.$ne) {
      filteredProperties = filteredProperties.filter(p => p.status !== filters.status.$ne);
    }
    
    if (filters['details.propertyType']) {
      filteredProperties = filteredProperties.filter(p => p.details.propertyType === filters['details.propertyType']);
    }
    
    return filteredProperties.length;
  }
}