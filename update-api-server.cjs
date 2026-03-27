const fs = require('fs');
const path = 'C:/source/appraisal-management-backend/src/api/api-server.ts';
let code = fs.readFileSync(path, 'utf8');

// Import
code = code.replace(
  "import { ReviewSLAWatcherJob } from '../jobs/review-sla-watcher.job';",
  "import { ReviewSLAWatcherJob } from '../jobs/review-sla-watcher.job';\nimport { ROVSLAWatcherJob } from '../jobs/rov-sla-watcher.job.js';"
);

// Property
code = code.replace(
  "private reviewSLAWatcherJob?: ReviewSLAWatcherJob;",
  "private reviewSLAWatcherJob?: ReviewSLAWatcherJob;\n  private rovSLAWatcherJob?: ROVSLAWatcherJob;"
);

// Start
code = code.replace(
  "// Start Review SLA Watcher Job",
  "try {\n      this.rovSLAWatcherJob = new ROVSLAWatcherJob();\n      this.rovSLAWatcherJob.start();\n    } catch (err) {\n      this.logger.warn('ROVSLAWatcherJob could not be created', {\n        error: err instanceof Error ? err.message : String(err)\n      });\n    }\n\n    // Start Review SLA Watcher Job"
);

// Stop
code = code.replace(
  "if (this.reviewSLAWatcherJob) {",
  "if (this.rovSLAWatcherJob) {\n      this.rovSLAWatcherJob.stop();\n    }\n    if (this.reviewSLAWatcherJob) {"
);

fs.writeFileSync(path, code);
