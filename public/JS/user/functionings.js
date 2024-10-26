function showSignUp() {
    const login_box = document.getElementById('login-box');
    const signUp_box = document.getElementById('signUp-box');
    login_box.classList.add('active');
    signUp_box.classList.add('active');
}
function hideSignUp() {
    const login_box = document.getElementById('login-box');
    const signUp_box = document.getElementById('signUp-box');
    login_box.classList.remove('active');
    signUp_box.classList.remove('active');
}

window.onload = function () {
    const timerDisplay = document.getElementById('timer');
    const resendButton = document.getElementById('resend-btn');
    // Check if the timer and resend button exist (i.e., we're on the OTP page)
    if (timerDisplay && resendButton) {
        let timeLeft = 30;

        // Countdown function
        const countdown = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(countdown);
                resendButton.disabled = false; // Enable the resend button
                timerDisplay.textContent = '0'; // Show 0 when time's up
            } else {
                timerDisplay.textContent = timeLeft;
            }
            timeLeft -= 1;
        }, 1000);  // Decrease time by 1 every second
    }
};