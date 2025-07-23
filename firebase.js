// Import the functions you need from the SDKs you need
//Avoid using a bundler!
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc } from 'firebase/firestore';
import dayjs from 'dayjs'

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


//WHEN A DAY IS CLICKED ON THE CALENDAR (check calendar.js for the rest)
function getAvailabilityStatus(date) {
  const dayOfWeek = dayjs(date).day();
  if (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5) { 
    return "Unavailable";
  } else {
    return "Available";
  }
}

async function getDailySchedule(date) {
  const formattedDate = dayjs(date).format('YYYY-MM-DD'); 
  const daysDocRef = doc(db, 'days', formattedDate); //Reference to the day's document
  const user = auth.currentUser; //get auth status, if auth retrieve everything, if not, exclude notes

  try {
    const dayDoc = await getDoc(daysDocRef);

    if (!dayDoc.exists()) {
      console.log("No schedule found for this day");
      return []; 
    }

    const dayData = dayDoc.data();
    const referencesArray = dayData.appointments || []; //If empty appointments, return null array

    // Create an array to hold promises for fetching daily schedules
    const schedulePromises = referencesArray.map(async (appointmentId) => {
      const appointmentDocRef = doc(db, 'dailySchedules', appointmentId);
      const appointmentDoc = await getDoc(appointmentDocRef);

      if (appointmentDoc.exists()) {
        const appointmentData = appointmentDoc.data();

        //Turn timeStart and timeEnd to strings in hh:mm format COURTESY OF CHATGPT
        const timeStartString = `${String(Math.floor(appointmentData.timeStart / 100)).padStart(2, '0')}:${String(appointmentData.timeStart % 100).padStart(2, '0')}`;
        const timeEndString = `${String(Math.floor(appointmentData.timeEnd / 100)).padStart(2, '0')}:${String(appointmentData.timeEnd % 100).padStart(2, '0')}`;

        const result = {
          timeStart: timeStartString,
          timeEnd: timeEndString,
          availability: appointmentData.availability, 
          id: appointmentId
        };

        if (user) { //If user is logged in
          result.notes = appointmentData.notes; 
        }

        return result; 
      } else {
        console.log(`No appointment found for ID: ${appointmentId}`);
        return null; 
      }
    });

    const schedules = await Promise.all(schedulePromises);
    //Make sure there are no empty appts
    return schedules.filter(schedule => schedule !== null);

  } catch (error) {
    console.error("Error fetching schedule: ", error);
    throw error; 
  }
}




onAuthStateChanged(auth, (user) => {
  if (user) { //if user exists (aka is logged in)
    document.querySelectorAll(".restricted").forEach(el => el.style.display = 'block');
  } else {
    //User is not logged in, hide restricted content
    document.querySelectorAll(".restricted").forEach(el => el.style.display = 'none');
  }
});



export { getAvailabilityStatus, getDailySchedule, auth, onAuthStateChanged, db };