// Helper function to show error
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.remove('hidden');
    errorElement.innerText = message;
    // isFormValid = false;
}

// Helper function to hide error
function hideError(elementId) {
    const errorElement = document.getElementById(elementId);
    errorElement.classList.add('hidden');
    // isFormValid = true;
}

function validatePercentage(){
    const percentage = document.querySelector('input[name="percentage"]').value;
    if (percentage < 0 || percentage > 100 || !percentage) {
        showError('percentageError', 'Percentage should be between 0 and 100.');
    } else {
        hideError('percentageError');
    }
}
function validateMaxDiscountAmt(){
    const maxDiscount = document.querySelector('input[name="maxDiscount"]').value;
    if (maxDiscount < 0 || !maxDiscount) {
        showError('maxDiscountError', 'Max discount cannot be negative.');
    } else {
        hideError('maxDiscountError');
    }
}
function validateFixedDiscountAmt(){
    const fixedAmount = document.querySelector('input[name="fixedAmount"]').value;
    if (fixedAmount < 0 || !fixedAmount) {
        showError('fixedAmountError', 'Fixed discount cannot be negative.');
        return false;
    } else {
        hideError('fixedAmountError');
        return true;
    }
}

// Product Name Validation
function validateName() {
    const name = document.querySelector('input[name="name"]').value.trim();
    if (name.length < 3) {
        showError('nameError', 'Product name must be at least 3 characters long.');
        return false;
    } else {
        hideError('nameError');
        return true;
    }
}

// Description Validation
function validateDescription() {
    const description = document.querySelector('textarea[name="description"]').value.trim();
    if (description.length < 10) {
        showError('descriptionError', 'Description must be at least 10 characters long.');
        return false;
    } else {
        hideError('descriptionError');
        return true;
    }
}

// Base Price Validation
function validateBasePrice() {
    const price = document.querySelector('input[name="price"]').value;
    if (price <= 0) {
        showError('priceError', 'Price must be greater than 0.');
        return false;
    } else {
        hideError('priceError');
        return true;
    }
}

// Maximum Retail Price Validation
function validateMrp() {
    const mrp = parseFloat(document.querySelector('input[name="mrp"]').value);
    const basePrice = parseFloat(document.querySelector('input[name="price"]').value);
    if (mrp < basePrice) {
        showError('mrpError', 'MRP should be greater than or equal to base price.');
        return false;
    } else {
        hideError('mrpError');
        return true;
    }
}

// Percentage Discount Validation
function validateOffers() {
    const offerType = document.getElementById('offerType').value;
    if(offerType === 'Percentage'){
        const percentage = document.querySelector('input[name="percentage"]').value;
        const maxDiscount = document.querySelector('input[name="maxDiscount"]').value;
        let isValid = true;
        if (percentage < 0 || percentage > 100 || !percentage) {
            showError('percentageError', 'Percentage should be between 0 and 100.');
            isValid = false;
        } else {
            hideError('percentageError');
        }
        if (maxDiscount < 0 || !maxDiscount) {
            showError('maxDiscountError', 'Max discount cannot be negative.');
            isValid = false;
        } else {
            hideError('maxDiscountError');
        }
        return isValid;
    }else if(offerType === 'Fixed'){
        const fixedAmount = document.querySelector('input[name="fixedAmount"]').value;
        if (fixedAmount < 0 || !fixedAmount) {
            showError('fixedAmountError', 'Fixed discount cannot be negative.');
            return false;
        } else {
            hideError('fixedAmountError');
            return true;
        }
    }
    return true;
}

// Quantity Validation
function validateQuantity() {
    const quantity = document.querySelector('input[name="stock"]').value;
    if (quantity < 0 || !quantity) {
        showError('quantityError', 'Quantity should be at least 0.');
        return false;
    } else {
        hideError('quantityError');
        return true;
    }
}

// Tags Validation
function validateTags() {
    const tags = document.querySelector('input[name="tags"]').value;
    if (tags.trim().length === 0) {
        showError('tagsError', 'Please enter at least one tag.');
        return false;
    } else {
        hideError('tagsError');
        return true;
    }
}

// Form Validation before Submission
function validateForm() {
    let hasError = false;
    let firstErrorField = null;

    // Validate each field and keep track of errors
    if (!validateName()){
        if (!firstErrorField) firstErrorField = document.getElementById("nameError");
        hasError = true;
    } 
    if (!validateDescription()){
        if (!firstErrorField) firstErrorField = document.getElementById("descriptionError");
        hasError = true;
    };
    if (!validateBasePrice()){
        if (!firstErrorField) firstErrorField = document.getElementById("priceError");
        hasError = true;
    };
    if (!validateMrp()){
        if (!firstErrorField) firstErrorField = document.getElementById("mrpError");
        hasError = true;
    };
    if (!validateOffers()){
        if (!firstErrorField) firstErrorField = document.getElementById("offerType");
        hasError = true;
    };
    if (!validateQuantity()) {
        if (!firstErrorField) firstErrorField = document.getElementById("quantityError");
        hasError = true;
    };
    if (!validateTags()){
        if (!firstErrorField) firstErrorField = document.getElementById("tagsError");
        hasError = true;
    };

    // Check if at least one image is uploaded
    const addedImagesContainer = document.getElementById("addedImagesContainer");
    const existingImages = addedImagesContainer.querySelectorAll('img');
    if (existingImages.length < 1) {
        if (!firstErrorField) firstErrorField = document.getElementById("imageError");
        hasError = true;
    };

    if (hasError) {
        firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
        return false; // Prevent form submission
    }
    return true;
}