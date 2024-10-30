let cropper;
function viewImage(event, index) {
    let input = event.target
    let reader = new FileReader()
    reader.onload = function () {
        let dataURL = reader.result;
        let image = document.getElementById('imgView' + index)
        image.src = function () {
            cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                guides: true,
                background: false,
                autoCropArea: 1,
                zoomable: true
            });

            let cropperContainer = document.querySelector('#croppedImg' + index).parentNode;
            cropperContainer.style.display = 'block';
            let saveButton = document.querySelector('#saveButton' + index)
            saveButton.addEventListener('click', async function () {
                let croppedCanvas = cropper.getCroppedCanvas();
                let croppedImage = document.getElementById('croppedImage' + index)
                croppedImage.src = croppedCanvas.toDataURL('image/jpeg', '1.0')

                let timestamp = new Date().getTime();
                let fileName = `cropped.img.${timestamp}.${index}`

                await croppedCanvas.toBlob(blob => {
                    let input = document.getElementById('input' + index)
                    let imgFile = new File([blob], fileName, blob)
                    const fileList = new DataTransfer();
                    fileList.items.add(imgFile);
                    input.files = fileList.files
                });

                cropperContainer.style.display = 'none'
                cropper.destroy()
            })
        }
        reader.readAsDataURL(input.files[0]);

    }
