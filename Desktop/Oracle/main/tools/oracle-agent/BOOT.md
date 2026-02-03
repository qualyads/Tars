# Oracle Agent Boot Tasks

## On Start
- log_startup
- check_api_health
- send_status

## Daily (07:00)
- morning_briefing
- sync_memory

## Hourly
- market_check

## Notes

Boot tasks run automatically when the server starts.
Add custom tasks by registering them in boot-system.js:

```javascript
import { registerTask } from './lib/boot-system.js';

registerTask('my_task', async (ctx) => {
  // Task logic here
});
```
