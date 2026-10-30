const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
exports.reference = () => {
  const app = {};
  app.window = app;
  vm.createContext(app);
  for (const name of ['portal-config.js', 'data.js', 'branch-model.js', 'saas-model.js', 'portal-model.js', 'employee-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', name), 'utf8'), app);
  }
  app.SaaSModel.installBranchRules(app.BranchModel);
  app.db = app.EmployeeModel.upgrade(app.PortalModel.upgrade(app.SaaSModel.upgrade(app.BranchModel.upgrade(app.DemoData.seed()))));
  return app;
};
