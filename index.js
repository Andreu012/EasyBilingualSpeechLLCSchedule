import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import weekOfYear from 'dayjs/plugin/weekOfYear';
dayjs.extend(weekday);
dayjs.extend(weekOfYear);

import './firebase.js';
import './login.js';
import './calendar.js';
import './modals.js';
import './calendar.css';
import './modals.css';
window.loggedin = false;
console.log(loggedin);
export {dayjs, weekday, weekOfYear};
