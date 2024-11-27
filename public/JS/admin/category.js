console.log("categories js working")
function confirmDelete(event, url) {
    event.preventDefault(); // Prevent the default link action

    Swal.fire({
        title: "Are you sure?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: "Deleted",
                text: "This category has been deleted.",
                icon: "success",
                timer: 1300,
                showConfirmButton: false
            }).then(() => {
                window.location.href = url;
            });
        }
    });
}

setTimeout(() => {
    const successDiv = document.getElementById('success_div');
    const errorDiv = document.getElementById('error_div');
    const successMessage = document.getElementById("success_message");
    const errorMessage = document.getElementById("error_message")

    if (successMessage.textContent !== '') {
        successDiv.style.opacity = "0";
        successMessage.textContent = ''
        setTimeout(() => successDiv.style.display = "none", 300); // Remove from view
    }

    if (errorMessage.textContent !== '') {
        errorDiv.style.opacity = "0";
        errorMessage.textContent = ''
        setTimeout(() => errorDiv.style.display = "none", 300); // Remove from view
    }
}, 3000);

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.remove('hidden');
    errorElement.innerText = message;
}

function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.add('hidden');
}

// Handle discount type change
function handleDiscountTypeChange() {
    const discountType = document.getElementById('discountType').value;
    const percentageFields = document.getElementById('percentageFields');
    const fixedFields = document.getElementById('fixedFields');

    if (discountType === 'Percentage') {
        percentageFields.classList.remove('hidden');
        fixedFields.classList.add('hidden');
        document.getElementById('fixedAmount').value = '';
    } else {
        percentageFields.classList.add('hidden');
        fixedFields.classList.remove('hidden');
        document.getElementById('percentage').value = '';
    }
}

// Validate percentage input
function validatePercentage() {
    const percentage = document.getElementById('percentage').value;
    if (percentage < 0 || percentage > 100 || !percentage) {
        showError('percentageError', 'Percentage should be between 0 and 100.');
        return false;
    } else {
        hideError('percentageError');
        return true;
    }
}

// Validate fixed amount input
function validateFixedAmount() {
    const fixedAmount = document.getElementById('fixedAmount').value;
    if (fixedAmount < 0 || !fixedAmount) {
        showError('fixedAmountError', 'Fixed amount cannot be negative.');
        return false;
    } else {
        hideError('fixedAmountError');
        return true;
    }
}

// Form validation before submission
function validateForm() {
    const discountType = document.getElementById('discountType').value;
    let isValid = true;

    // Validate category name and description
    const name = document.getElementById('category_name').value.trim();
    if (name.length < 3) {
        isValid = false;
    }

    const description = document.getElementById('description').value.trim();
    if (description.length < 10) {
        isValid = false;
    }

    // Validate discount fields based on type
    if (discountType === 'Percentage') {
        isValid = validatePercentage() && isValid;
    } else {
        isValid = validateFixedAmount() && isValid;
    }

    return isValid;
}