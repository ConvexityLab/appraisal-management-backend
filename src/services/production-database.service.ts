import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { 
  AppraisalOrder, 
  Vendor, 
  OrderFilters, 
  PropertyDetails,
  PropertySummary,
  PropertyAddress,
  ApiResponse
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Production MongoDB Database Service
 * Implements all required interfaces for the appraisal management system
 */
export class ProductionDatabaseService {
  private logger: Logger;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected: boolean = false;

  // Collections
  private ordersCollection: Collection<AppraisalOrder> | null = null;
  private vendorsCollection: Collection<Vendor> | null = null;
  private propertiesCollection: Collection<PropertyDetails> | null = null;
  private propertySummariesCollection: Collection<PropertySummary> | null = null;

  constructor(private connectionString: string = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/appraisal_management') {
    this.logger = new Logger();
  }

  /**
   * Connect to MongoDB database
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to MongoDB database');
      
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        family: 4
      });

      await this.client.connect();
      this.db = this.client.db();
      
      // Initialize collections
      this.ordersCollection = this.db.collection<AppraisalOrder>('orders');
      this.vendorsCollection = this.db.collection<Vendor>('vendors');
      this.propertiesCollection = this.db.collection<PropertyDetails>('properties');
      this.propertySummariesCollection = this.db.collection<PropertySummary>('property_summaries');

      // Create indexes for optimal performance
      await this.createIndexes();

      this.isConnected = true;
      this.logger.info('Successfully connected to MongoDB');

    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', { error });
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.logger.info('Disconnected from MongoDB');
    }
  }

  /**
   * Check if database is connected
   */
  isDbConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get database instance
   */
  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  /**
   * Get collection by name
   */
  getCollection<T = any>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection<T>(name);
  }

  /**
   * Create collection with proper validation
   */
  async createCollection(name: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    
    try {
      await this.db.createCollection(name);
      this.logger.info(`Collection created: ${name}`);
    } catch (error: any) {
      if (error.code !== 48) { // Collection already exists
        throw error;
      }
    }
  }

  // ===============================
  // Order Operations
  // ===============================

  async createOrder(order: Omit<AppraisalOrder, 'id'>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.ordersCollection) throw new Error('Orders collection not initialized');

      const orderWithId = {
        ...order,
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.ordersCollection.insertOne(orderWithId as AppraisalOrder);
      
      if (!result.acknowledged) {
        throw new Error('Failed to create order');
      }

      const createdOrder = await this.ordersCollection.findOne({ _id: result.insertedId });
      
      return {
        success: true,
        data: createdOrder!,
        message: 'Order created successfully'
      };

    } catch (error) {
      this.logger.error('Failed to create order', { error });
      return {
        success: false,
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findOrderById(id: string): Promise<ApiResponse<AppraisalOrder | null>> {
    try {
      if (!this.ordersCollection) throw new Error('Orders collection not initialized');

      const order = await this.ordersCollection.findOne({ id });
      
      return {
        success: true,
        data: order,
        message: order ? 'Order found' : 'Order not found'
      };

    } catch (error) {
      this.logger.error('Failed to find order', { error, id });
      return {
        success: false,
        data: null,
        error: 'Failed to find order',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findOrders(filters: OrderFilters, offset: number = 0, limit: number = 50): Promise<ApiResponse<AppraisalOrder[]>> {
    try {
      if (!this.ordersCollection) throw new Error('Orders collection not initialized');

      // Build MongoDB query from filters
      const query: any = {};
      
      if (filters.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }
      if (filters.priority && filters.priority.length > 0) {
        query.priority = { $in: filters.priority };
      }
      if (filters.productType && filters.productType.length > 0) {
        query.productType = { $in: filters.productType };
      }
      if (filters.assignedVendorId) {
        query.assignedVendorId = filters.assignedVendorId;
      }
      if (filters.createdFrom || filters.createdTo) {
        query.createdAt = {};
        if (filters.createdFrom) query.createdAt.$gte = filters.createdFrom;
        if (filters.createdTo) query.createdAt.$lte = filters.createdTo;
      }

      const [orders, total] = await Promise.all([
        this.ordersCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        this.ordersCollection.countDocuments(query)
      ]);

      return {
        success: true,
        data: orders,
        message: `Found ${orders.length} orders`,
        metadata: { total, offset, limit }
      };

    } catch (error) {
      this.logger.error('Failed to find orders', { error, filters });
      return {
        success: false,
        data: [],
        error: 'Failed to find orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateOrder(id: string, updates: Partial<AppraisalOrder>): Promise<ApiResponse<AppraisalOrder>> {
    try {
      if (!this.ordersCollection) throw new Error('Orders collection not initialized');

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      const result = await this.ordersCollection.findOneAndUpdate(
        { id },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return {
          success: false,
          error: 'Order not found',
          message: `Order with id ${id} not found`
        };
      }

      return {
        success: true,
        data: result.value,
        message: 'Order updated successfully'
      };

    } catch (error) {
      this.logger.error('Failed to update order', { error, id });
      return {
        success: false,
        error: 'Failed to update order',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteOrder(id: string): Promise<ApiResponse<boolean>> {
    try {
      if (!this.ordersCollection) throw new Error('Orders collection not initialized');

      const result = await this.ordersCollection.deleteOne({ id });

      return {
        success: result.deletedCount > 0,
        data: result.deletedCount > 0,
        message: result.deletedCount > 0 ? 'Order deleted successfully' : 'Order not found'
      };

    } catch (error) {
      this.logger.error('Failed to delete order', { error, id });
      return {
        success: false,
        data: false,
        error: 'Failed to delete order',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===============================
  // Vendor Operations
  // ===============================

  async createVendor(vendor: Omit<Vendor, 'id' | 'onboardingDate' | 'lastActive'>): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.vendorsCollection) throw new Error('Vendors collection not initialized');

      const vendorWithId = {
        ...vendor,
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        onboardingDate: new Date(),
        lastActive: new Date()
      };

      const result = await this.vendorsCollection.insertOne(vendorWithId as Vendor);
      
      if (!result.acknowledged) {
        throw new Error('Failed to create vendor');
      }

      const createdVendor = await this.vendorsCollection.findOne({ _id: result.insertedId });
      
      return {
        success: true,
        data: createdVendor!,
        message: 'Vendor created successfully'
      };

    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      return {
        success: false,
        error: 'Failed to create vendor',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findVendorById(id: string): Promise<ApiResponse<Vendor | null>> {
    try {
      if (!this.vendorsCollection) throw new Error('Vendors collection not initialized');

      const vendor = await this.vendorsCollection.findOne({ id });
      
      return {
        success: true,
        data: vendor,
        message: vendor ? 'Vendor found' : 'Vendor not found'
      };

    } catch (error) {
      this.logger.error('Failed to find vendor', { error, id });
      return {
        success: false,
        data: null,
        error: 'Failed to find vendor',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findVendors(filters: any, offset: number = 0, limit: number = 50): Promise<ApiResponse<Vendor[]>> {
    try {
      if (!this.vendorsCollection) throw new Error('Vendors collection not initialized');

      // Build MongoDB query from filters
      const query: any = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.licenseState) {
        query.licenseState = filters.licenseState;
      }
      if (filters.productTypes && filters.productTypes.length > 0) {
        query.productTypes = { $in: filters.productTypes };
      }
      if (filters.specialties && filters.specialties.length > 0) {
        query.specialties = { $in: filters.specialties };
      }

      const [vendors, total] = await Promise.all([
        this.vendorsCollection
          .find(query)
          .sort({ onboardingDate: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        this.vendorsCollection.countDocuments(query)
      ]);

      return {
        success: true,
        data: vendors,
        message: `Found ${vendors.length} vendors`,
        metadata: { total, offset, limit }
      };

    } catch (error) {
      this.logger.error('Failed to find vendors', { error, filters });
      return {
        success: false,
        data: [],
        error: 'Failed to find vendors',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateVendor(id: string, updates: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    try {
      if (!this.vendorsCollection) throw new Error('Vendors collection not initialized');

      const updateData = {
        ...updates,
        lastActive: new Date()
      };

      const result = await this.vendorsCollection.findOneAndUpdate(
        { id },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return {
          success: false,
          error: 'Vendor not found',
          message: `Vendor with id ${id} not found`
        };
      }

      return {
        success: true,
        data: result.value,
        message: 'Vendor updated successfully'
      };

    } catch (error) {
      this.logger.error('Failed to update vendor', { error, id });
      return {
        success: false,
        error: 'Failed to update vendor',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteVendor(id: string): Promise<ApiResponse<boolean>> {
    try {
      if (!this.vendorsCollection) throw new Error('Vendors collection not initialized');

      const result = await this.vendorsCollection.deleteOne({ id });

      return {
        success: result.deletedCount > 0,
        data: result.deletedCount > 0,
        message: result.deletedCount > 0 ? 'Vendor deleted successfully' : 'Vendor not found'
      };

    } catch (error) {
      this.logger.error('Failed to delete vendor', { error, id });
      return {
        success: false,
        data: false,
        error: 'Failed to delete vendor',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===============================
  // Property Operations
  // ===============================

  async createProperty(property: Omit<PropertySummary, 'id' | 'lastUpdated'>): Promise<ApiResponse<PropertySummary>> {
    try {
      if (!this.propertySummariesCollection) throw new Error('Property summaries collection not initialized');

      const propertyWithId = {
        ...property,
        _id: new ObjectId(),
        id: new ObjectId().toString(),
        lastUpdated: new Date()
      };

      const result = await this.propertySummariesCollection.insertOne(propertyWithId as PropertySummary);
      
      if (!result.acknowledged) {
        throw new Error('Failed to create property');
      }

      const createdProperty = await this.propertySummariesCollection.findOne({ _id: result.insertedId });
      
      return {
        success: true,
        data: createdProperty!,
        message: 'Property created successfully'
      };

    } catch (error) {
      this.logger.error('Failed to create property', { error });
      return {
        success: false,
        error: 'Failed to create property',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findPropertyById(id: string): Promise<ApiResponse<PropertySummary | null>> {
    try {
      if (!this.propertySummariesCollection) throw new Error('Property summaries collection not initialized');

      const property = await this.propertySummariesCollection.findOne({ id });
      
      return {
        success: true,
        data: property,
        message: property ? 'Property found' : 'Property not found'
      };

    } catch (error) {
      this.logger.error('Failed to find property', { error, id });
      return {
        success: false,
        data: null,
        error: 'Failed to find property',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async findProperties(filters: any, offset: number = 0, limit: number = 50): Promise<ApiResponse<PropertySummary[]>> {
    try {
      if (!this.propertySummariesCollection) throw new Error('Property summaries collection not initialized');

      // Build MongoDB query from filters
      const query: any = {};
      
      if (filters.propertyType) {
        query.propertyType = { $in: Array.isArray(filters.propertyType) ? filters.propertyType : [filters.propertyType] };
      }
      if (filters.address) {
        if (filters.address.state) query['address.state'] = filters.address.state;
        if (filters.address.city) query['address.city'] = filters.address.city;
        if (filters.address.zip) query['address.zip'] = filters.address.zip;
      }
      if (filters.priceRange) {
        query['valuation.estimatedValue'] = {};
        if (filters.priceRange.min) query['valuation.estimatedValue'].$gte = filters.priceRange.min;
        if (filters.priceRange.max) query['valuation.estimatedValue'].$lte = filters.priceRange.max;
      }

      const [properties, total] = await Promise.all([
        this.propertySummariesCollection
          .find(query)
          .sort({ lastUpdated: -1 })
          .skip(offset)
          .limit(limit)
          .toArray(),
        this.propertySummariesCollection.countDocuments(query)
      ]);

      return {
        success: true,
        data: properties,
        message: `Found ${properties.length} properties`,
        metadata: { total, offset, limit }
      };

    } catch (error) {
      this.logger.error('Failed to find properties', { error, filters });
      return {
        success: false,
        data: [],
        error: 'Failed to find properties',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ===============================
  // Database Indexes
  // ===============================

  private async createIndexes(): Promise<void> {
    try {
      this.logger.info('Creating database indexes');

      // Order indexes
      if (this.ordersCollection) {
        await Promise.all([
          this.ordersCollection.createIndex({ id: 1 }, { unique: true }),
          this.ordersCollection.createIndex({ orderNumber: 1 }, { unique: true }),
          this.ordersCollection.createIndex({ status: 1 }),
          this.ordersCollection.createIndex({ priority: 1 }),
          this.ordersCollection.createIndex({ assignedVendorId: 1 }),
          this.ordersCollection.createIndex({ createdAt: -1 }),
          this.ordersCollection.createIndex({ dueDate: 1 }),
          this.ordersCollection.createIndex({ productType: 1 }),
          this.ordersCollection.createIndex({ 'property.address.state': 1 }),
          this.ordersCollection.createIndex({ 'property.address.city': 1 })
        ]);
      }

      // Vendor indexes
      if (this.vendorsCollection) {
        await Promise.all([
          this.vendorsCollection.createIndex({ id: 1 }, { unique: true }),
          this.vendorsCollection.createIndex({ email: 1 }, { unique: true }),
          this.vendorsCollection.createIndex({ licenseNumber: 1 }),
          this.vendorsCollection.createIndex({ licenseState: 1 }),
          this.vendorsCollection.createIndex({ status: 1 }),
          this.vendorsCollection.createIndex({ productTypes: 1 }),
          this.vendorsCollection.createIndex({ specialties: 1 }),
          this.vendorsCollection.createIndex({ onboardingDate: -1 })
        ]);
      }

      // Property indexes
      if (this.propertySummariesCollection) {
        await Promise.all([
          this.propertySummariesCollection.createIndex({ id: 1 }, { unique: true }),
          this.propertySummariesCollection.createIndex({ 'address.state': 1 }),
          this.propertySummariesCollection.createIndex({ 'address.city': 1 }),
          this.propertySummariesCollection.createIndex({ 'address.zip': 1 }),
          this.propertySummariesCollection.createIndex({ propertyType: 1 }),
          this.propertySummariesCollection.createIndex({ 'valuation.estimatedValue': 1 }),
          this.propertySummariesCollection.createIndex({ 'building.yearBuilt': 1 }),
          this.propertySummariesCollection.createIndex({ 'building.livingAreaSquareFeet': 1 }),
          this.propertySummariesCollection.createIndex({ lastUpdated: -1 }),
          // Compound indexes for common queries
          this.propertySummariesCollection.createIndex({ 'address.state': 1, propertyType: 1 }),
          this.propertySummariesCollection.createIndex({ propertyType: 1, 'valuation.estimatedValue': 1 }),
          // Geospatial index
          this.propertySummariesCollection.createIndex({ 'address.location': '2dsphere' })
        ]);
      }

      this.logger.info('Database indexes created successfully');

    } catch (error) {
      this.logger.error('Failed to create database indexes', { error });
      throw error;
    }
  }

  // ===============================
  // Health Check
  // ===============================

  async healthCheck(): Promise<{ status: string; database: string; collections: string[] }> {
    try {
      if (!this.db) {
        throw new Error('Database not connected');
      }

      await this.db.admin().ping();
      
      const collections = await this.db.listCollections().toArray();
      
      return {
        status: 'healthy',
        database: this.db.databaseName,
        collections: collections.map(c => c.name)
      };

    } catch (error) {
      this.logger.error('Database health check failed', { error });
      throw error;
    }
  }
}

export default ProductionDatabaseService;