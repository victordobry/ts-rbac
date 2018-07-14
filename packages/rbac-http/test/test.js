const assert = require('assert');
const express = require('express');

const { RbacHttpAssignmentAdapter } = require("../dist");
const { RbacHttpItemAdapter } = require("../dist");
const { RbacHttpItemChildAdapter } = require("../dist");
const { RbacHttpRuleAdapter } = require("../dist");

describe('RbacHttpAssignmentAdapter', () => {
  const rbacAssignments = [
    { userId: 'alexey', role: 'admin' },
    { userId: 'ilya', role: 'manager' }
  ];
  const assignmentAdapter = new RbacHttpAssignmentAdapter({
    baseUrl: 'http://localhost:4000',
    headers: {}
  });
  let server;

  before(async () => {
    const app = express();
    server = app.listen(4000);
    app.use(express.json());
    app.post('/rbac/assignments', (request, response) => {
      response.json(request.body);
    });
    app.get('/rbac/assignments/:userId/:role', (request, response) => {
      const { userId, role } = request.params;
      response.json(rbacAssignments.find((assignment) => {
        return assignment.userId === userId && assignment.role === role;
      }));
    });
    app.get('/rbac/assignments/:userId', (request, response) => {
      response.json(rbacAssignments.filter((assignment) => {
        return assignment.userId === request.params.userId
      }));
    });
    app.get('/rbac/assignments', (request, response) => {
      response.json({ rbacAssignments });
    });
    app.delete('/rbac/assignments/:userId/:role', (request, response) => {
      const { userId, role } = request.params;
      const assignmentIndex = rbacAssignments.findIndex((assignment) => {
        return assignment.userId === userId && assignment.role === role;
      });
      if (assignmentIndex !== -1) {
        rbacAssignments.splice(assignmentIndex, 1);
      } else {
        return response.status(400).json({ message: `Role ${role} is already assigned to user ${userId}.` });
      }
      response.status(200).send();
    });
  });

  after((done) => {
    server.close(done);
  });

  it('should load data via http', async () => {
    const response = await assignmentAdapter.load();
    assert.deepEqual(response.data.rbacAssignments, rbacAssignments);
  });

  it('should store data over http', async () => {
    const response = await assignmentAdapter.store(rbacAssignments);
    assert.deepEqual(response.data.rbacAssignments, rbacAssignments);
  });

  it('should create user assignment', async () => {
    const assignment = { userId: 'alexey', role: 'admin' };
    const response = await assignmentAdapter.create(assignment.userId, assignment.role);
    assert.deepEqual(response.data, assignment);
  });

  it('should find assignments by user', async () => {
    const assignments = [{ userId: 'alexey', role: 'admin' }];
    const response = await assignmentAdapter.findByUserId('alexey');
    assert.deepEqual(response.data, assignments);
  });

  it('should not delete missing assignment', async () => {
    const assignment = { userId: 'alexey', role: 'user' };
    try {
      await assignmentAdapter.delete(assignment.userId, assignment.role);
    } catch (error) {
      assert.deepEqual(error.response.data, { message: `Role ${assignment.role} is already assigned to user ${assignment.userId}.` });
    }
  });

  it('should delete assignment', async () => {
    const assignment = { userId: 'alexey', role: 'admin' };
    await assignmentAdapter.delete(assignment.userId, assignment.role);
    assert.deepEqual(rbacAssignments.length, 1);
  });
});

describe('RbacHttpItemAdapter', () => {
  const rbacItems = [
    { name: 'admin', type: 'role' },
    { name: 'manager', type: 'role' },
    { name: 'user', type: 'role' },
    { name: 'updateProfile', type: 'permission' },
    { name: 'updateOwnProfile', type: 'permission', rule: 'IsOwnProfile' },
  ];
  const itemAdapter = new RbacHttpItemAdapter({
    baseUrl: 'http://localhost:4000',
    headers: {}
  });
  let server;

  before(async () => {
    const app = express();
    server = app.listen(4000);
    app.use(express.json());
    app.post('/rbac/items', (request, response) => {
      if (request.body.name) {
        const { name } = request.body;
        if (rbacItems.find(item => item.name === name)) {
          return response.status(400).json({ message: `Item ${name} already exists.` });
        }
      }
      response.json(request.body);
    });
    app.get('/rbac/items', (request, response) => {
      response.json({ rbacItems });
    });
    app.get('/rbac/items/:name', (request, response) => {
      const { name } = request.params;
      response.json(rbacItems.find(item => item.name === name));
    });
  });

  after((done) => {
    server.close(done);
  });

  it('should load data via http', async () => {
    const response = await itemAdapter.load();
    assert.deepEqual(response.data.rbacItems, rbacItems);
  });

  it('should store data over http', async () => {
    const response = await itemAdapter.store(rbacItems);
    assert.deepEqual(response.data.rbacItems, rbacItems);
  });

  it('should not create existing item', async () => {
    const item = { name: 'updateOwnProfile', type: 'permission', rule: 'IsAuthor' };
    try {
      await itemAdapter.create(item.name, item.type, item.rule);
      assert.fail('Should throw on create.');
    } catch (error) {
      assert.equal(error.message, `Item ${item.name} already exists.`)
    }
  });

  it('should create item', async () => {
    const assignment = { name: 'updateOwnPost', type: 'permission', rule: 'IsAuthor' };
    const response = await itemAdapter.create(assignment.name, assignment.type, assignment.rule);
    assert.deepEqual(response.data, assignment);
  });

  it('should find item by name', async () => {
    const item = { name: 'updateOwnProfile', type: 'permission', rule: 'IsOwnProfile' };
    const response = await itemAdapter.find('updateOwnProfile');
    assert.deepEqual(response.data, item);
  });
});

describe('RbacHttpItemChildAdapter', () => {
  const rbacItemChildren = [
    { parent: 'admin', child: 'manager' },
    { parent: 'manager', child: 'user' },
    { parent: 'user', child: 'updateOwnProfile' },
    { parent: 'updateOwnProfile', child: 'updateProfile' },
    { parent: 'admin', child: 'updateProfile' }
  ];
  const itemChildAdapter = new RbacHttpItemChildAdapter({
    baseUrl: 'http://localhost:4000',
    headers: {}
  });
  let server;

  before(async () => {
    const app = express();
    server = app.listen(4000);
    app.use(express.json());
    app.post('/rbac/item-children', (request, response) => {
      if (request.body.parent) {
        const { parent, child } = request.body;
        if (rbacItemChildren.find(itemChild => itemChild.parent === parent && itemChild.child === child)) {
          return response.status(400).json({ message: `Association of ${parent} and ${child} already exists.` });
        }
        response.status(200).json(request.body);
      }
      if (request.body.rbacItemChildren) {
        response.status(200).json(request.body);
      }
    });
    app.get('/rbac/item-children', (request, response) => {
      response.json({ rbacItemChildren });
    })
    app.get('/rbac/item-children/:parent', (request, response) => {
      const {parent} = request.params;
      response.json(rbacItemChildren.filter(itemChild => itemChild.parent === parent));
    })
  });

  after((done) => {
    server.close(done);
  });

  it('should load data via http', async () => {
    const response = await itemChildAdapter.load();
    assert.deepEqual(response.data.rbacItemChildren, rbacItemChildren);
  });

  it('should store data over http', async () => {
    const response = await itemChildAdapter.store(rbacItemChildren);
    assert.deepEqual(response.data.rbacItemChildren, rbacItemChildren);
  });

  it('should not create existing item child', async () => {
    const itemChild = { parent: 'admin', child: 'manager' };
    try {
      const response = await itemChildAdapter.create(itemChild.parent, itemChild.child);
      assert.fail('Should throw on create.');
    } catch (error) {
      assert.equal(error.message, `Association of ${itemChild.parent} and ${itemChild.child} already exists.`);
    }
  });

  it('should create item child', async () => {
    const itemChild = { parent: 'admin', child: 'user' };
    const response = await itemChildAdapter.create(itemChild.parent, itemChild.child);
    assert.deepEqual(response.data, itemChild);
  });

  it('should find item children by parent', async () => {
    const itemChildren = [{ parent: 'user', child: 'updateOwnProfile' }]
    const response = await itemChildAdapter.findByParent('user');
    assert.deepEqual(response.data, itemChildren);
  });
});

describe('RbacHttpRuleAdapter', () => {
  const rbacRules = [
    { name: 'IsOwnProfile' }
  ];
  let server;

  before(async () => {
    const app = express();
    server = app.listen(4000);
    app.get('/rbac/rules', (request, response) => {
      response.json({ rbacRules });
    })
  });

  after((done) => {
    server.close(done);
  });

  it('should load data via http', async () => {
    const ruleAdapter = new RbacHttpRuleAdapter({
      baseUrl: 'http://localhost:4000',
      headers: {}
    });
    const response = await ruleAdapter.load();
    assert.deepEqual(response.data.rbacRules, rbacRules);
  });
});
