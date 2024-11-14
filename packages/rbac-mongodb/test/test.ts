import mongoose from 'mongoose';

import { RbacAssignment, RbacAssignmentAdapter, RbacItem, RbacItemAdapter, RbacItemChild, RbacItemChildAdapter, RbacRule, RbacRuleAdapter } from '@brainstaff/rbac';

import { RbacMongodbAssignmentAdapter } from '../src/index.js';
import { RbacMongodbItemAdapter } from '../src/index.js';
import { RbacMongodbItemChildAdapter } from '../src/index.js';
import { RbacMongodbRuleAdapter } from '../src/index.js';

interface Logger {
  info: (message: string) => void;
}

class MongooseConnection {
  private logger: Logger;
  
  constructor(uri: string, deps: {
    logger: Logger,
  }) {
    this.logger = deps.logger;
    mongoose.connect(uri);
    mongoose.connection.on('reconnectFailed', () => {
      this.logger.info('Mongoose reconnection failed.');
    });
    mongoose.connection.on('connected', () => {
      this.logger.info('Established connection to Mongodb');
    });
    mongoose.connection.on('error', () => {
      this.logger.info('Error connecting to Mongodb');
      mongoose.disconnect();
    });
    mongoose.connection.on('disconnected', () => {
      this.logger.info('Disconnected from Mongodb');
    });
  }

  disconnect() {
    mongoose.disconnect();
  }
}

const mongooseConnection = new MongooseConnection('mongodb://localhost:27017/rbac-test', {
  logger: {
    info: (message: string) => console.log(message),
  },
});

const timeout = 10000;

let expect: Chai.ExpectStatic;

before(async () => {
  const chai = await import('chai');
  expect = chai.expect;
});

after(() => mongooseConnection.disconnect());

describe('RbacMongodbAssignmentAdapter', () => {
  const rbacAssignments: RbacAssignment[] = [
    { userId: 'alexey', role: 'admin' },
    { userId: 'ilya', role: 'manager' }
  ];
  const rbacAssignmet: RbacAssignment = { userId: 'igor', role: 'manager' };

  it('should store many assignments', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.store(rbacAssignments);
    expect(result).to.be.an('array').that.have.length(2);
    expect(result[0]).to.include(rbacAssignments[0]);
    expect(result[1]).to.include(rbacAssignments[1]);
  }).timeout(timeout);

  it('should load all assignment', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.load();
    expect(result).to.be.an('array').that.have.length(2);
    const members: any[] = [];
    result.forEach((item: any) => members.push(item.userId));
    expect(members).to.have.members([rbacAssignments[0].userId, rbacAssignments[1].userId]);
  }).timeout(timeout);

  it('should create single assignment', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.create(rbacAssignmet.userId, rbacAssignmet.role);
    expect(result).to.be.an('object').that.include(rbacAssignmet);
  }).timeout(timeout);

  it('should find single assignments', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.find(rbacAssignmet.userId, rbacAssignmet.role);
    expect(result).to.be.an('object').that.include(rbacAssignmet);
  }).timeout(timeout);

  it('should find all assignments by user', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.findByUserId(rbacAssignmet.userId);
    expect(result).to.be.an('array').that.have.length(1);
    expect(result[0]).to.include(rbacAssignmet);
  }).timeout(timeout);

  it('should delete single assignments', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.delete(rbacAssignmet.userId, rbacAssignmet.role);
    expect(result).to.be.an('object').that.include(rbacAssignmet);
    const remainData = await adapter.load();
    expect(remainData).to.be.an('array').that.have.length(2);
  }).timeout(timeout);

  it('should delete all assignments by user', async () => {
    const adapter: RbacAssignmentAdapter = new RbacMongodbAssignmentAdapter();
    const result = await adapter.deleteByUser(rbacAssignments[0].userId);
    expect(result).to.be.an('object').that.include({ deletedCount: 1, acknowledged: true });
    const remainData = await adapter.load();
    expect(remainData).to.be.an('array').that.have.length(1);
  }).timeout(timeout);
});

describe('RbacMongodbItemAdapter', () => {
  const rbacItems: RbacItem[] = [
    { name: 'admin', type: 'role' },
    { name: 'manager', type: 'role' },
    { name: 'user', type: 'role' },
    { name: 'updateProfile', type: 'permission' },
    { name: 'updateOwnProfile', type: 'permission', rule: 'IsOwnProfile' }
  ];
  const rbacItem: RbacItem = { name: 'region manager', type: 'role' };

  it('should store many items', async () => {
    const adapter: RbacItemAdapter = new RbacMongodbItemAdapter();
    const result = await adapter.store(rbacItems);
    expect(result).to.be.an('array').that.have.length(5);
    result.forEach((item: any, index: any) => expect(item).to.include(rbacItems[index]));
  }).timeout(timeout);

  it('should load all items', async () => {
    const adapter: RbacItemAdapter = new RbacMongodbItemAdapter();
    const result = await adapter.load();
    expect(result).to.be.an('array').that.have.length(5);
    const members: any[] = [];
    result.forEach((item: any) => members.push(item.name));
    expect(members).to.have.members(rbacItems.map(item => item.name));
  }).timeout(timeout);

  it('should load all roles', async () => {
    const adapter: RbacItemAdapter = new RbacMongodbItemAdapter();
    const result = await adapter.findByType('role');
    expect(result).to.be.an('array').that.have.length(3);
    const members: any[] = [];
    result.forEach((item: any) => members.push(item.name));
    expect(members).to.have.members(rbacItems.reduce((result, item) => {
      if (item.type === 'role') {
        result.push(item.name);
      }
      return result;
    }, [] as any[]));
  }).timeout(timeout);

  it('should create single item', async () => {
    const adapter: RbacItemAdapter = new RbacMongodbItemAdapter();
    const result = await adapter.create(rbacItem.name, rbacItem.type);
    expect(result).to.be.an('object').that.include(rbacItem);
  }).timeout(timeout);

  it('should find single item by name', async () => {
    const adapter: RbacItemAdapter = new RbacMongodbItemAdapter();
    const result = await adapter.find(rbacItem.name);
    expect(result).to.be.an('object').that.include(rbacItem);
  }).timeout(timeout);
});

describe('RbacMongodbItemChildAdapter', () => {
  const rbacItemChildren: RbacItemChild[] = [
    { parent: 'admin', child: 'manager' },
    { parent: 'manager', child: 'user' },
    { parent: 'user', child: 'updateOwnProfile' },
    { parent: 'updateOwnProfile', child: 'updateProfile' },
    { parent: 'admin', child: 'updateProfile' }
  ];
  const rbacItemChild: RbacItemChild = { parent: 'manager', child: 'region manager' };

  it('should store many children items', async () => {
    const adapter: RbacItemChildAdapter = new RbacMongodbItemChildAdapter();
    const result = await adapter.store(rbacItemChildren);
    expect(result).to.be.an('array').that.have.length(5);
    result.forEach((item: any, index: any) => expect(item).to.include(rbacItemChildren[index]));
  }).timeout(timeout);

  it('should load all child items', async () => {
    const adapter: RbacItemChildAdapter = new RbacMongodbItemChildAdapter();
    const result = await adapter.load();
    expect(result).to.be.an('array').that.have.length(5);
    const members: any[] = [];
    result.forEach((item: any) => members.push(item.parent));
    expect(members).to.have.members(rbacItemChildren.map(item => item.parent));
  }).timeout(timeout);

  it('should create single child item', async () => {
    const adapter: RbacItemChildAdapter = new RbacMongodbItemChildAdapter();
    const result = await adapter.create(rbacItemChild.parent, rbacItemChild.child);
    expect(result).to.be.an('object').that.include(rbacItemChild);
  }).timeout(timeout);

  it('should find all children item by parent', async () => {
    const adapter: RbacItemChildAdapter = new RbacMongodbItemChildAdapter();
    const result = await adapter.findByParent(rbacItemChildren[0].parent);
    expect(result).to.be.an('array').that.have.length(2);
  }).timeout(timeout);
});

describe('RbacMongodbRuleAdapter', () => {
  const rbacRules: RbacRule[] = [
    { name: 'IsOwnProfile' },
    { name: 'IsOwnDocument' }
  ];
  const rbacRule: RbacRule = { name: 'IsGroupLeader' };

  it('should store many rules', async () => {
    const adapter: RbacRuleAdapter = new RbacMongodbRuleAdapter();
    const result = await adapter.store(rbacRules);
    expect(result).to.be.an('array').that.have.length(2);
    result.forEach((item: any, index: any) => expect(item).to.include(rbacRules[index]));
  }).timeout(timeout);

  it('should load all rules', async () => {
    const adapter: RbacRuleAdapter = new RbacMongodbRuleAdapter();
    const result = await adapter.load();
    expect(result).to.be.an('array').that.have.length(2);
    const members: any[] = [];
    result.forEach((item: any) => members.push(item.name));
    expect(members).to.have.members(rbacRules.map(item => item.name));
  }).timeout(timeout);

  it('should create single rule', async () => {
    const adapter: RbacRuleAdapter = new RbacMongodbRuleAdapter();
    const result = await adapter.create(rbacRule.name);
    expect(result).to.be.an('object').that.include(rbacRule);
  }).timeout(timeout);
});
