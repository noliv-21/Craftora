//Global
const phone_check = /^([\d]{10})$/
const email_check = /^([A-Za-z0-9_\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
const password_check = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[~!@#$%^&*()-_+=])[A-Za-z\d~!@#$%^&*()-_+=]{8,64}$/;

//Login
var login_cred = document.getElementById('login_cred-input')
var login_cred_error = document.getElementById('login_cred_error')
var login_pass = document.getElementById('login_pass-input')
var login_pass_error = document.getElementById('login_pass_error')

function validate_login_cred() {
  if (login_cred.value.trim() === '') {
    login_cred_error.textContent = 'Username or E-Mail is required'
  } else {
    login_cred_error.textContent = ''
  }
}
function validate_login_pass() {
  if (login_pass.value.trim() === '') {
    login_pass_error.textContent = 'Password is required'
  } else if (!password_check.test(login_pass.value)) {
    login_pass_error.textContent = "Must include at least one uppercase, lowercase, symbols, digits, and it should be of 8 letters."
  } else {
    login_pass_error.textContent = ''
  }
}
//        submit prevention
const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  validate_login_cred();
  validate_login_pass();
  if (login_cred_error.textContent === "" && login_pass_error.textContent === '') {
    loginForm.submit();
  }
});


//Sign Up
var username_error = document.getElementById('username_error');
var usernameInput = document.getElementById('username-input');
var emailInput = document.getElementById('email-input')
var email_error = document.getElementById('email_error');
var phoneInput = document.getElementById('phone-input')
var phone_error = document.getElementById('phone_error')
var passwordInput = document.getElementById('password-input');
var password_error = document.getElementById('password_error');
var cfm_password = document.getElementById('cfm_password-input')
var cfm_password_err = document.getElementById('cfm_password_error')

function validate_username() {
  if (usernameInput.value.trim() === '') {
    username_error.textContent = "Username is required.";
  } else {
    username_error.textContent = '';
  }
}

function validate_email() {
  if (emailInput.value.trim() === "") {
    email_error.textContent = "Email is required.";
  } else if (!email_check.test(emailInput.value)) {
    email_error.textContent = "E-mail is not in correct format";
  } else {
    email_error.textContent = "";
  }
}

function validate_phone() {
  if (phoneInput.value.trim() === '') {
    phone_error.textContent = 'Phone is required'
  } else if (!phone_check.test(phoneInput.value)) {
    phone_error.textContent = 'It should be a 10-digit number'
  } else {
    phone_error.textContent = '';
  }
}

function validate_password() {
  // const password_check = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()-+=]).{8,}$/;

  if (passwordInput.value.trim() === "") {
    password_error.textContent = "Password is required.";
  } else if (!password_check.test(passwordInput.value)) {
    password_error.textContent = "Must include at least one uppercase, lowercase, symbols, digits, and it should be of 8 letters.";
  } else {
    password_error.textContent = "";
  }
}

function validate_cfm_password() {
  if (cfm_password.value.trim() === '') {
    cfm_password_err.textContent = "Please confirm password."
  } else if (cfm_password.value !== passwordInput.value) {
    cfm_password_err.textContent = "Passwords doesn't match"
  } else {
    cfm_password_err.textContent = ""
  }
}

//        submit prevention
const signUpForm = document.getElementById('signUpForm');
signUpForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (cfm_password_err.textContent == '' &&
    password_error.textContent == '' &&
    phone_error.textContent == '' &&
    email_error.textContent == '' &&
    username_error.textContent == '') {
      // Extract form data
    const formData = new FormData(signUpForm);
    const email = formData.get('email'); // Get the email from the form input
    try {
      const response = await fetch('/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }), // Send the email dynamically
      });

      const data = await response.json();
      console.log(data);

      // Submit the form programmatically after the OTP request
      signUpForm.submit();

    } catch (error) {
      console.error('Error:', error);
      signUpForm.submit();
    }
  }
});

