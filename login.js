import { getAuth, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import { closeModal } from './modals.js';

const auth = getAuth();

const loginForm = document.getElementById('login-form');
const loginModal = document.getElementById('login-modal');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault(); 

  const enteredEmail = document.getElementById('email').value;
  const enteredPassword = document.getElementById('password').value;

  try {
    await signInWithEmailAndPassword(auth, enteredEmail, enteredPassword);

    //If successful, show restricted elements
    document.querySelectorAll(".restricted").forEach(el => el.style.display = 'block');

    window.loggedin = true;
    console.log(window.loggedin);

    closeModal(loginModal);
  } catch (error) {
    console.error('Firebase Auth error:', error);
    displayErrorMessage('Invalid email or password');
  }
});

function logOutUser() {
  signOut(auth).then(() => {
      console.log('User signed out successfully.');
  }).catch((error) => {
      console.error('Error signing out:', error);
  });
}
//When page is reloaded
window.addEventListener('beforeunload', logOutUser);

function displayErrorMessage(message) {
  const errorMessage = document.createElement('p');
  errorMessage.textContent = message;
  errorMessage.style.color = 'red';
  loginForm.appendChild(errorMessage);
}
