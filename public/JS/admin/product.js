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

function confirmDelete(event, url) {
    event.preventDefault();

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