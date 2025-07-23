import dayjs from 'dayjs';
import { dailyScheduleModal } from './modals.js';
import { getAvailabilityStatus, getDailySchedule, db } from './firebase.js';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, FieldValue, arrayUnion, deleteDoc, arrayRemove } from 'firebase/firestore'; //everything i may need

const auth = getAuth();

//Sets up HTML structure for calendar, days of week and days are set up as ordered lists
document.getElementById("app").innerHTML = `
<div class="calendar-month">
  <section class="calendar-month-header">
    <section class="calendar-month-header-selectors">
      <span id="previous-month-selector">Previous</span>
      <div id="selected-month" class="calendar-month-header-selected-month"></div>
      <span id="next-month-selector">Next</span>
    </section>
    <span id="present-month-selector"></span>
  </section>
  <ol id="days-of-week" class="day-of-week"></ol>
  <ol id="calendar-days" class="days-grid"></ol>
</div>
`;


const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = dayjs().format("YYYY-MM-DD");

const INITIAL_YEAR = dayjs().format("YYYY");
const INITIAL_MONTH = dayjs().format("M");
//dayjs().format(___) returns the current of whatever is being called (be it month year or day)

let selectedMonth = dayjs(new Date(INITIAL_YEAR, INITIAL_MONTH - 1, 1));
//The date object can be made many ways, but in this project, we are only worried about using years months and days
let currentMonthDays, previousMonthDays, nextMonthDays;

const daysOfWeekElement = document.getElementById("days-of-week");

//This creates and adds list items for each weekday in the form of abbreviations, to an HTML element, displaying them as a list.
WEEKDAYS.forEach((weekday) => {
  const weekDayElement = document.createElement("li");
  weekDayElement.innerText = weekday;
  daysOfWeekElement.appendChild(weekDayElement);
});

createCalendar();
initMonthSelectors();

function createCalendar(year = INITIAL_YEAR, month = INITIAL_MONTH) {
  //calendar-days declared earlier in innerHTML section
  const calendarDaysElement = document.getElementById("calendar-days");
  document.getElementById("selected-month").innerText = dayjs(new Date(year, month - 1)).format("MMMM YYYY");
  //ran before you create a whole new monthly calendar when you paginate each month
  removeAllDayElements(calendarDaysElement);

  currentMonthDays = createDaysForCurrentMonth(year, month);
  previousMonthDays = createDaysForPreviousMonth(year, month);
  nextMonthDays = createDaysForNextMonth(year, month);

  const days = [...previousMonthDays, ...currentMonthDays, ...nextMonthDays];
  //'spreads' (using the ellipsis) each array passed through here into the new "days" array
  days.forEach((day) => {
    appendDay(day, calendarDaysElement);
  });
}

function appendDay(day, calendarDaysElement) {
  const dayElement = document.createElement("li");
  dayElement.classList.add("calendar-day");

  const dayOfMonthElement = document.createElement("span");
  dayOfMonthElement.innerText = day.dayOfMonth;
  dayElement.appendChild(dayOfMonthElement);

  calendarDaysElement.appendChild(dayElement);
  //when days are not in current month, they must be classified so they can be changed in appearance
  if (!day.isCurrentMonth) {
    dayElement.classList.add("calendar-day--not-current");
  }
  //add elemenent to select in css so you can highlight 'today'
  if (day.date === TODAY) {
    dayElement.classList.add("calendar-day--today");
  }
  const dayOfWeek = dayjs(day.date).day(); // day() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
    dayElement.style.backgroundColor = "#d14949"; // Color the day red for weekends
    if (!day.isCurrentMonth) {
      dayElement.style.backgroundColor = "#fa8989";
    }
  }

  //Uniquely for daily schedule modal
  dayElement.addEventListener("click", function () {
    openDailyScheduleModal(day.date);
  });
}

let currentModalDate;

async function openDailyScheduleModal(date) {
  dailyScheduleModal.style.display = "flex";
  currentModalDate = date;

  dailyScheduleModal.querySelector('.schedule-header p:first-child').innerText = dayjs(date).format('dddd, MMMM D, YYYY');  //COURTESY OF CHATGPT

  const availabilityStatus = getAvailabilityStatus(date);
  const availabilityHeader = dailyScheduleModal.querySelector('.schedule-header p:nth-child(2)')
  availabilityHeader.innerText = availabilityStatus;
  
  switch (availabilityStatus.toLowerCase()) {
    case 'available':
      availabilityHeader.style.color = '#89cc04'; //Green
      break;
    case 'unavailable':
      availabilityHeader.style.color = '#cc1804'; //Red
      break;
    case 'evaluation only':
      availabilityHeader.style.color = '#ccab04'; //Yellow
      break;
    default:
      availabilityHeader.style.color = '#000';
      break;
  }

  availabilityHeader.style.fontWeight = 'bold';
  availabilityHeader.style.fontSize = '16px';


  const user = auth.currentUser;
  const addApptButton = dailyScheduleModal.querySelector('.add-appointment');

  if (user) {
    addApptButton.style.display = 'block';
  } else {
    addApptButton.style.display = 'none';
  }

  addApptButton.addEventListener("click", function (event) {
    event.preventDefault();
    addAppointment(currentModalDate);
  });

  document.getElementById('close-add-appt-modal').addEventListener('click', function () {
    document.getElementById('add-appt-modal').style.display = 'none';
  });

  const timeGrid = document.getElementById('time-grid');
  timeGrid.innerHTML = ''; //Clears previous schedule if one has been loaded
  let startHour = 8;
  let endHour = 17;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minutes = 0; minutes < 60; minutes += 15) {
      let timeSlot = document.createElement('div');
      timeSlot.classList.add('time-slot');

      let timeString = `${hour < 10 ? '0' : ''}${hour}:${minutes === 0 ? '00' : minutes}`; //Courtesy of ChatGPT
      timeSlot.innerHTML = `<span class="time-label">${timeString}</span>`; 

      timeGrid.appendChild(timeSlot);
    }
  }
  const schedule = await getDailySchedule(date);

  schedule.forEach(appointment => {
    const { timeStart, timeEnd, id, availability, notes } = appointment;

    const startTime = timeStringToMinutes(timeStart);
    const endTime = timeStringToMinutes(timeEnd);

    const timeSlots = Array.from(timeGrid.getElementsByClassName('time-slot'));

    //Overlay color for RANGE of time covered by the schedule object
    timeSlots.forEach(slot => {
      const slotTime = slot.querySelector('.time-label').innerText;
      const slotMinutes = timeStringToMinutes(slotTime);

      if (slotMinutes >= startTime && slotMinutes < endTime) {
        // Change background color based on availability
        let color;
        switch (availability) {
          case 'available':
            color = '#89cc04'; // Green
            break;
          case 'unavailable':
            color = '#cc1804'; // Red
            break;
          case 'evaluation only':
            color = '#ccab04'; // Yellow
            break;
          default:
            color = '#cccccc'; //this wont happen but i need it
            break;
        }

        slot.style.backgroundColor = color;

        const timeInfo = document.createElement('div');
        timeInfo.classList.add('time-info');
        timeInfo.innerHTML = `<strong>Start Time: ${timeStart}, End Time: ${timeEnd}</strong>`;
        timeInfo.style.fontSize = '10px'; // Adjust size to fit within the slot
        timeInfo.style.color = '#000'; // Ensure contrast with background
        timeInfo.style.marginLeft = '5%'; // Add margin to the left for spacing

        slot.appendChild(timeInfo);
        // If the user is logged in, add an edit button
        const user = auth.currentUser;
        if (user) {
          const editButton = document.createElement('button');
          editButton.innerText = "Edit";
          editButton.classList.add('edit-button');
          editButton.onclick = () => editAppointment(date, id);
          slot.appendChild(editButton);

          const deleteButton = document.createElement('button');
          deleteButton.innerText = "Delete";
          deleteButton.classList.add('delete-button');
          deleteButton.onclick = () => {
            if (confirm("Are you sure you want to delete this appointment?")) {
              deleteAppointment(id, currentModalDate); 
            }
          };
          slot.appendChild(deleteButton);

          const notesButton = document.createElement('button');
          notesButton.innerText = "Notes";
          notesButton.classList.add('notes-button');
          notesButton.onclick = () => showNotesModal(notes);
          slot.appendChild(notesButton);
        }
      }
    });
  });
}
// Utility function to convert time string to minutes
function timeStringToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Utility function to format time (from integer like 800 to '08:00')
function formatTime(time) {
  let hours = Math.floor(time / 100);
  let minutes = time % 100;
  return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
}
async function deleteAppointment(appointmentId,currentModalDate) {
  const dailyScheduleModal = document.getElementById('daily-schedule-modal');

  const appointmentDocRef = doc(db, 'dailySchedules', appointmentId);
  console.log(appointmentDocRef);
  try {
    // First, delete from from dailySchedules
    await deleteDoc(appointmentDocRef);
    console.log('Appointment deleted successfully');

    //Secondly, remove the appt from the /days collection
    const dayDocRef = doc(db, 'days', currentModalDate); 
    await updateDoc(dayDocRef, {
      appointments: arrayRemove(appointmentId) 
    });

    dailyScheduleModal.style.display = "none"; 
    openDailyScheduleModal(currentModalDate); 
  } catch (error) {
    console.error('Error deleting appointment:', error);
  }
}



// Function to show the notes modal
function showNotesModal(notes) {
  const notesModal = document.getElementById('notes-modal');
  const notesContent = document.getElementById('notes-content'); // Get the notes content area
  notesContent.innerText = notes; // Populate the notes
  notesModal.style.display = 'flex'; // Display the modal

  // Add close functionality for the modal
  const closeModal = notesModal.querySelector('.close-notes-modal');
  const closeText = notesModal.querySelector('.close-text');

  // Close when "X" or "Close" is clicked
  closeModal.addEventListener('click', () => {
    notesModal.style.display = 'none';
  });

  closeText.addEventListener('click', () => {
    notesModal.style.display = 'none';
  });

  // Close modal when clicking outside the content area
  window.addEventListener('click', function (event) {
    if (event.target === notesModal) {
      notesModal.style.display = 'none';
    }
  });
}

function addAppointment(date) {
  // Close the daily schedule modal if it's open
  const dailyScheduleModal = document.getElementById('daily-schedule-modal'); 
  dailyScheduleModal.style.display = 'none'; // Close daily schedule modal

  // Show the add appointment modal
  const addApptModal = document.getElementById('add-appt-modal');
  addApptModal.style.display = 'flex'; // Show the modal

  const formattedDate = dayjs(date).format('YYYY-MM-DD');

  // Add a listener to the form submission
  const addApptForm = document.getElementById('add-appt-form');

  // Clear previous values in case of repeated submissions
  addApptForm.reset();

  addApptForm.onsubmit = function (event) {
    event.preventDefault(); 

    const daysDocRef = doc(collection(db, 'days'), formattedDate);

    getDoc(daysDocRef).then(docSnap => {
      let existingAppointments = []; //Array to store existing appointments for overlap check

      if (docSnap.exists()) {
        const dayData = docSnap.data();
        existingAppointments = (dayData && dayData.appointments) ? dayData.appointments : [];
      } else {
        const newDayData = { appointments: [] };
        setDoc(daysDocRef, newDayData);
      }
      const newAppointmentDocId = `${formattedDate}-${Date.now()}`; // Using timestamp for uniqueness
      //From form submission
      const newAppointment = {
        availability: document.getElementById('availability').value,
        timeStart: parseInt(document.getElementById('timeStart').value.replace(':', '')),
        timeEnd: parseInt(document.getElementById('timeEnd').value.replace(':', '')),
        notes: document.getElementById('notes').value,
        id: newAppointmentDocId
      };

      let hasOverlap = false;

      if (existingAppointments.length > 0) {
        //Check for time overlaps with existing appointments
        const overlapChecks = existingAppointments.map(existingId => {
          const existingAppointmentDocRef = doc(collection(db, 'dailySchedules'), existingId);
          return getDoc(existingAppointmentDocRef).then(existingDocSnap => {
            if (existingDocSnap.exists()) {
              const existingAppointment = existingDocSnap.data();
              const existingStart = existingAppointment.timeStart;
              const existingEnd = existingAppointment.timeEnd;

              // Check if new appointment to be added overlaps with existing appointment
              if (newAppointment.timeStart < existingEnd && newAppointment.timeEnd > existingStart) {
                hasOverlap = true; 
              }
            }
          });
        });

        // Wait for all overlap checks to complete then decide
        Promise.all(overlapChecks).then(() => {
          if (hasOverlap) {
            console.error('Error: Appointment times overlap!');
            alert('Error: Appointment times overlap! Please choose a different time.');
            return; 
          }

          //If no overlaps, proceed 
          createNewAppointment(newAppointment, newAppointmentDocId, daysDocRef, formattedDate);
        });
      } else {
        //If no existing appointments, proceed without checking
        createNewAppointment(newAppointment, newAppointmentDocId, daysDocRef, formattedDate);
      }
    }).catch(error => {
      console.error('Error retrieving day data: ', error);
    });
  };
}

function createNewAppointment(newAppointment, newAppointmentDocId, daysDocRef, formattedDate) {
  const newAppointmentDocRef = doc(collection(db, 'dailySchedules'), newAppointmentDocId);

  setDoc(newAppointmentDocRef, newAppointment)
    .then(() => {
      console.log('Appointment added successfully!');

      //Update the /days doc to include the new reference
      updateDoc(daysDocRef, { 
        appointments: arrayUnion(newAppointmentDocId) 
      }).then(() => {
        console.log('Reference array updated');
        document.getElementById('add-appt-modal').style.display = 'none'; 
        openDailyScheduleModal(formattedDate);
      }).catch(error => {
        console.error('Error updating reference array: ', error);
      });
    })
    .catch(error => {
      console.error('Error adding appointment: ', error);
    });
}



// Function to open the edit appointment modal
async function editAppointment(date, appointmentDocId) {
  dailyScheduleModal.style.display = 'none'; 
  try {
    const appointmentDocRef = doc(db, 'dailySchedules', appointmentDocId);
    const appointmentDoc = await getDoc(appointmentDocRef);

    if (appointmentDoc.exists()) {
      const appointmentData = appointmentDoc.data();

      //Populate the fields with the current schedule object data
      document.getElementById('edit-availability').value = appointmentData.availability;
      document.getElementById('edit-timeStart').value = String(appointmentData.timeStart).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2');
      document.getElementById('edit-timeEnd').value = String(appointmentData.timeEnd).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2');
      document.getElementById('edit-notes').value = appointmentData.notes;

      document.getElementById('edit-appt-modal').style.display = 'flex';

      //Add form submission handler to update the appointment
      const editApptForm = document.getElementById('edit-appt-form');
      editApptForm.onsubmit = function (event) {
        const timeStart = document.getElementById('edit-timeStart').value;
        const timeEnd = document.getElementById('edit-timeEnd').value;
        if (timeEnd <= timeStart) {
          event.preventDefault(); 
          alert('Error: End time must be after start time!');
          return; 
        }

        event.preventDefault(); 
        // Create updated appointment object from input values
        const updatedAppointment = {
          availability: document.getElementById('edit-availability').value,
          timeStart: parseInt(document.getElementById('edit-timeStart').value.replace(':', '')),
          timeEnd: parseInt(document.getElementById('edit-timeEnd').value.replace(':', '')),
          notes: document.getElementById('edit-notes').value,
        };
        updateAppointment(appointmentDocId, updatedAppointment);
      };

      // Add event listener to close the edit modal when "X" is clicked
      const closeEditModalButton = document.getElementById('close-edit-appt-modal');
      if (closeEditModalButton) { // Check if the button exists
        closeEditModalButton.addEventListener('click', function () {
          document.getElementById('edit-appt-modal').style.display = 'none'; // Close modal
        });
      } else {
        console.error("Close edit modal button not found!");
      }

    } else {
      console.error("Appointment document does not exist.");
      alert("Appointment document does not exist.");
    }
  } catch (error) {
    console.error("Error fetching appointment document:", error);
  }
}


// Function to update the appointment in Firebase
function updateAppointment(appointmentDocId, updatedAppointment) {
  const appointmentDocRef = doc(db, 'dailySchedules', appointmentDocId);

  setDoc(appointmentDocRef, updatedAppointment, { merge: true }) 
    .then(() => {
      console.log('Appointment updated successfully!');
      document.getElementById('edit-appt-modal').style.display = 'none'; 
    })
    .catch((error) => {
      console.error('Error updating appointment: ', error);
      alert('Error updating appointment. Please try again.');
    });
}

//executed before new month is 'created' when calendar goes to next month
function removeAllDayElements(calendarDaysElement) {
  while (calendarDaysElement.firstChild) { //loops until no more children exist
    calendarDaysElement.removeChild(calendarDaysElement.firstChild);
  }
}

function getNumberOfDaysInMonth(year, month) {
  return dayjs(`${year}-${month}-01`).daysInMonth();
}

function createDaysForCurrentMonth(year, month) {
  return [...Array(getNumberOfDaysInMonth(year, month))].map((_, index) => {
    return {
      date: dayjs(`${year}-${month}-${index + 1}`).format("YYYY-MM-DD"),
      dayOfMonth: index + 1,
      isCurrentMonth: true
    };
  });
}
//previous month and next month days are to be greyed out, so they must be identified
function createDaysForPreviousMonth(year, month) {
  const firstDayOfTheMonth = dayjs(`${year}-${month}-01`);
  const firstDayOfTheMonthWeekday = getWeekday(firstDayOfTheMonth.format("YYYY-MM-DD"));

  const previousMonth = firstDayOfTheMonth.subtract(1, "month");

  let visibleNumberOfDaysFromPreviousMonth = firstDayOfTheMonthWeekday ? firstDayOfTheMonthWeekday - 1 : 6;

  const previousMonthLastMondayDayOfMonth = firstDayOfTheMonth.subtract(visibleNumberOfDaysFromPreviousMonth, "day").date();

  return Array.from({ length: visibleNumberOfDaysFromPreviousMonth }, (_, index) => {
    const day = previousMonthLastMondayDayOfMonth + index;
    return {
      date: dayjs(`${previousMonth.year()}-${previousMonth.month() + 1}-${day}`).format("YYYY-MM-DD"),
      dayOfMonth: day,
      isCurrentMonth: false
    };
  });
}

function createDaysForNextMonth(year, month) {
  const lastDayOfTheMonth = dayjs(`${year}-${month}-${getNumberOfDaysInMonth(year, month)}`);
  const lastDayOfTheMonthWeekday = getWeekday(lastDayOfTheMonth.format("YYYY-MM-DD"));

  const nextMonth = lastDayOfTheMonth.add(1, "month");

  let visibleNumberOfDaysFromNextMonth = lastDayOfTheMonthWeekday ? 7 - lastDayOfTheMonthWeekday : lastDayOfTheMonthWeekday;

  return Array.from({ length: visibleNumberOfDaysFromNextMonth }, (_, index) => {
    const day = index + 1;
    return {
      date: dayjs(`${nextMonth.year()}-${nextMonth.month() + 1}-${day}`).format("YYYY-MM-DD"),
      dayOfMonth: day,
      isCurrentMonth: false
    };
  });
}

function getWeekday(date) {
  return dayjs(date).day();
}


function initMonthSelectors() {
  document.getElementById("previous-month-selector").addEventListener("click", function () {
    selectedMonth = dayjs(selectedMonth).subtract(1, "month");
    createCalendar(selectedMonth.format("YYYY"), selectedMonth.format("M"));
  });

  document.getElementById("present-month-selector").addEventListener("click", function () {
    selectedMonth = dayjs(new Date(INITIAL_YEAR, INITIAL_MONTH - 1, 1));
    createCalendar(selectedMonth.format("YYYY"), selectedMonth.format("M"));
  });

  document.getElementById("next-month-selector").addEventListener("click", function () {
    selectedMonth = dayjs(selectedMonth).add(1, "month");
    createCalendar(selectedMonth.format("YYYY"), selectedMonth.format("M"));
  });
}

//Sometimes the device is too tall and it results in a lot of empty space & small boxes to click
// this makes it so that the height of the calendar adjusts accordingly

function adjustCalendarDayHeight() {
  const minHeight = 80; //Starts at 80 minimum pixels
  const screenHeight = window.innerHeight;

  let extraHeight = 0;
  if (screenHeight > 830) {
    extraHeight = (screenHeight - 830) / 10 * 3;
  }

  const calendarDays = document.querySelectorAll('.calendar-day');
  calendarDays.forEach(day => {
    day.style.minHeight = `${minHeight + extraHeight}px`; //change style attribute
  });
}
//Call the above function when the page loads and is resized
window.addEventListener('load', adjustCalendarDayHeight);
window.addEventListener('resize', adjustCalendarDayHeight);
