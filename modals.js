export { dailyScheduleModal }; //needed in calendar.js
export { closeModal };
const aboutModal = document.getElementById("about-modal");
const loginModal = document.getElementById("login-modal");
const dailyScheduleModal = document.getElementById("daily-schedule-modal");

const aboutButton = document.getElementById("about-modal-button");
const loginButton = document.getElementById("login-modal-button");
//noDailySchedule button because you have to click days on the calendar

const closeAboutModal = document.querySelector(".close-about-modal");
const closeDailyScheduleModal = document.querySelector(".close-daily-schedule-modal");
const closeLoginModal = document.querySelector(".close-login-modal");

function openModal(modal) {
  modal.style.display = "flex"; 
}

function closeModal(modal) {
  modal.style.display = "none";
}

aboutButton.addEventListener("click", () => openModal(aboutModal));
loginButton.addEventListener("click", () => openModal(loginModal));

//Closing modals from x button
closeAboutModal.addEventListener("click", () => closeModal(aboutModal));
closeLoginModal.addEventListener("click", () => closeModal(loginModal));
closeDailyScheduleModal.addEventListener("click", () => closeModal(dailyScheduleModal));

//If you click outside the modal window, it will close the modal
window.addEventListener("click", (event) => {
  if (event.target === aboutModal) {
    closeModal(aboutModal);
  }
  if (event.target === loginModal) {
    closeModal(loginModal);
  }
  if (event.target === dailyScheduleModal) {
    closeModal(dailyScheduleModal);
  }
});

 