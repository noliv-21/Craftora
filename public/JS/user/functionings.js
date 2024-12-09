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

function resendOtp() {
    const timerDisplay = document.getElementById('timer');
    const resendButton = document.getElementById('resend-btn');
    
    const resendAttempts = parseInt(localStorage.getItem('otpResendAttempts') || '0');

    if (resendAttempts >= 2) {
        Toastify({
            text: "Maximum OTP resend attempts reached. Please go to the login page.",
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: "linear-gradient(135deg, #ef4444, #fca5a5)",
            stopOnFocus: true,
            className: "toast_style"
        }).showToast();
        return;
    }

    async function performResend() {
        try {
            const response = await axios.post('/user/otp_resend');
            if (response.status === 200) {
                const newResendAttempts = resendAttempts + 1;
                localStorage.setItem('otpResendAttempts', newResendAttempts.toString());

                // Reset timer
                let timeLeft = 30;
                const timerEnd = Date.now() + (timeLeft * 1000);
                localStorage.setItem('otpTimerEnd', timerEnd.toString());
                
                // Disable resend button and restart countdown
                resendButton.disabled = true;
                
                // Update timer display and logic
                function updateTimer() {
                    if (timeLeft <= 0) {
                        clearInterval(countdown);
                        resendButton.disabled = false;
                        timerDisplay.textContent = '0';
                        localStorage.removeItem('otpTimerEnd');
                    } else {
                        timerDisplay.textContent = timeLeft;
                        timeLeft -= 1;
                    }
                }

                // Initial update
                updateTimer();

                // Countdown function
                const countdown = setInterval(updateTimer, 1000);

                // Show success toast
                Toastify({
                    text: response.data.message,
                    duration: 2000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(135deg, #f97316, #fbbf24)",
                    stopOnFocus: true,
                    className: "toast_style"
                }).showToast();
            } else {
                // Show error toast
                Toastify({
                    text: response.data,
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(135deg, #ef4444, #fca5a5)",
                    stopOnFocus: true,
                    className: "toast_style"
                }).showToast();
            }
        } catch (error) {
            // Show error toast
            Toastify({
                text: "Error resending OTP. Please try again.",
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "linear-gradient(135deg, #ef4444, #fca5a5)",
                stopOnFocus: true,
                className: "toast_style"
            }).showToast();
        }
    }

    performResend();
}

window.onload = function () {
    if (!localStorage.getItem('otpTimerEnd')) {
        localStorage.removeItem('otpResendAttempts');
    }

    const timerDisplay = document.getElementById('timer');
    const resendButton = document.getElementById('resend-btn');
    
    // Check if the timer and resend button exist (i.e., we're on the OTP page)
    if (timerDisplay && resendButton) {
        const resendAttempts = parseInt(localStorage.getItem('otpResendAttempts') || '0');
        // Disable resend button if max attempts reached
        if (resendAttempts >= 2) {
            resendButton.disabled = true;
            timerDisplay.textContent = '0';
            localStorage.removeItem('otpTimerEnd');
            return;
        }
        // Retrieve stored timer data
        const storedTimerEnd = localStorage.getItem('otpTimerEnd');
        const currentTime = Date.now();
        
        let timeLeft;
        
        if (storedTimerEnd && parseInt(storedTimerEnd) > currentTime) {
            // If there's a valid stored timer, calculate remaining time
            timeLeft = Math.ceil((parseInt(storedTimerEnd) - currentTime) / 1000);
        } else {
            // If no stored timer or timer expired, start a new 30-second countdown
            timeLeft = 30;
            const timerEnd = currentTime + (timeLeft * 1000);
            localStorage.setItem('otpTimerEnd', timerEnd.toString());
        }

        // Function to update timer
        function updateTimer() {
            // Check if max attempts reached
            const resendAttempts = parseInt(localStorage.getItem('otpResendAttempts') || '0');
            if (resendAttempts >= 2) {
                clearInterval(countdown);
                resendButton.disabled = true;
                timerDisplay.textContent = '0';
                localStorage.removeItem('otpTimerEnd');
                return;
            }

            if (timeLeft <= 0) {
                clearInterval(countdown);
                resendButton.disabled = false;
                timerDisplay.textContent = '0';
                localStorage.removeItem('otpTimerEnd');
            } else {
                timerDisplay.textContent = timeLeft;
                timeLeft -= 1;
            }
        }

        // Initial update
        updateTimer();

        // Countdown function
        const countdown = setInterval(updateTimer, 1000);

        // Add event listener to clear timer when resend is clicked
        resendButton.addEventListener('click', () => {
            localStorage.removeItem('otpTimerEnd');
        });
    }
};