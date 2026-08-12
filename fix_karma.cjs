const fs = require('fs');
const file = '__tests__/karma.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/'Tier 0'/g, "'Tier 0 (Unscored)'");
content = content.replace(/'Tier 1'/g, "'Tier 1 (Emerging)'");
content = content.replace(/'Tier 2'/g, "'Tier 2 (Established)'");
content = content.replace(/'Tier 3'/g, "'Tier 3 (Seasoned)'");
fs.writeFileSync(file, content);
