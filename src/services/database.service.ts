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

  async create(order: AppraisalOrder): Promise<AppraisalOrder> {
    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<AppraisalOrder | null> {
    return this.orders.get(id) || null;
  }

  async findMany(filters: OrderFilters, offset: number, limit: number): Promise<{ orders: AppraisalOrder[]; total: number }> {
    const allOrders = Array.from(this.orders.values());
    // Apply filters here
    const filteredOrders = allOrders; // Simplified for now
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