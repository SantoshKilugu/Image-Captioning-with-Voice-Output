// DOM Elements
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const webcamButton = document.getElementById('webcamButton');
const webcamContainer = document.querySelector('.webcam-container');
const webcam = document.getElementById('webcam');
const captureButton = document.getElementById('captureButton');
const canvas = document.getElementById('canvas');
const processButton = document.getElementById('processButton');
const loading = document.getElementById('loading');
const status = document.getElementById('status');
const langButtons = document.getElementById('langButtons');
const captionText = document.getElementById('captionText');
const audioPlayer = document.getElementById('audioPlayer');
const copyButton = document.getElementById('copyButton');
const downloadButton = document.getElementById('downloadButton');
const historyButton = document.getElementById('historyButton');
const historyContainer = document.getElementById('historyContainer');

// Global variables
let currentCaption = '';
let currentImage = null;
let webcamStream = null;
let imageData = null;
let history = JSON.parse(localStorage.getItem('icasgHistory')) || [];
let availableLanguages = {};
let allCaptions = {}; // Store all language captions here
let currentLanguage = 'English'; // Default language

// Indian languages array for special styling
const indianLanguages = ['Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Bengali'];

// Initialize the application
function init() {
    // Add event listeners
    imageUpload.addEventListener('change', handleImageUpload);
    webcamButton.addEventListener('click', toggleWebcam);
    captureButton.addEventListener('click', capturePhoto);
    processButton.addEventListener('click', processImage);
    copyButton.addEventListener('click', copyCaption);
    downloadButton.addEventListener('click', downloadAudio);
    historyButton.addEventListener('click', toggleHistory);
    
    // Hide elements initially
    hideElement(loading);
    hideElement(processButton);
    webcamContainer.style.display = 'none';
    
    // Disable audio elements initially
    audioPlayer.disabled = true;
    downloadButton.disabled = true;
    copyButton.disabled = true;
    
    // Load history
    renderHistory();
    
    // Fetch supported languages from the server
    fetchLanguages();
}

// Fetch supported languages from the server
function fetchLanguages() {
    fetch('/languages')
        .then(response => response.json())
        .then(data => {
            availableLanguages = data.languages;
            generateLanguageButtons(availableLanguages);
        })
        .catch(error => {
            console.error('Error fetching languages:', error);
            // Fallback to hardcoded languages if API fails
            const fallbackLanguages = {
                'English': 'en',
                'Spanish': 'es',
                'French': 'fr',
                'German': 'de',
                'Italian': 'it',
                'Hindi': 'hi',
                'Chinese': 'zh',
                'Japanese': 'ja',
                'Korean': 'ko',
                'Arabic': 'ar',
                'Russian': 'ru',
                'Portuguese': 'pt',
                // Added South Indian languages and Bengali
                'Telugu': 'te',
                'Tamil': 'ta',
                'Kannada': 'kn',
                'Malayalam': 'ml',
                'Bengali': 'bn'
            };
            availableLanguages = fallbackLanguages;
            generateLanguageButtons(fallbackLanguages);
        });
}

// Generate language buttons
function generateLanguageButtons(languages) {
    langButtons.innerHTML = '';
    
    // Sort languages alphabetically but keep English first
    const sortedLanguages = Object.entries(languages).sort((a, b) => {
        if (a[0] === 'English') return -1;
        if (b[0] === 'English') return 1;
        return a[0].localeCompare(b[0]);
    });
    
    sortedLanguages.forEach(([name, code]) => {
        const button = document.createElement('button');
        button.className = 'btn language-btn';
        
        // Add special class for Indian languages
        if (indianLanguages.includes(name)) {
            button.classList.add('indian-lang');
        }
        
        button.textContent = name;
        button.dataset.lang = code;
        button.dataset.langName = name;
        button.addEventListener('click', () => {
            // Update active button style
            document.querySelectorAll('.language-btn').forEach(btn => {
                btn.style.fontWeight = 'normal';
                btn.style.transform = 'scale(1)';
            });
            button.style.fontWeight = 'bold';
            button.style.transform = 'scale(1.05)';
            
            // Show caption in the selected language
            showCaptionInLanguage(name);
            // Generate speech for the selected language
            generateSpeech(code, name);
        });
        langButtons.appendChild(button);
    });
}

// Show caption in the selected language
function showCaptionInLanguage(language) {
    if (allCaptions && allCaptions[language]) {
        captionText.textContent = allCaptions[language];
        currentLanguage = language;
        currentCaption = allCaptions[language];
        updateStatus(`Showing caption in ${language}`);
    } else if (!allCaptions[language] && Object.keys(allCaptions).length > 0) {
        updateStatus(`Caption not available in ${language}`);
    }
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageData = e.target.result;
            displayImage(imageData);
            
            // Hide webcam if open
            if (webcamStream) {
                toggleWebcam();
            }
        };
        reader.readAsDataURL(file);
    }
}

// Display image in preview
function displayImage(src) {
    imagePreview.src = src;
    showElement(imagePreview);
    showElement(processButton);
    updateStatus('Image loaded. Click "Process Image" to generate a caption.');
}

// Toggle webcam
function toggleWebcam() {
    if (webcamStream) {
        // Stop webcam
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
        webcamContainer.style.display = 'none';
        webcamButton.innerHTML = '<i class="fas fa-camera"></i> Open Webcam';
    } else {
        // Start webcam
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    webcamStream = stream;
                    webcam.srcObject = stream;
                    webcamContainer.style.display = 'flex';
                    webcamButton.innerHTML = '<i class="fas fa-times"></i> Close Webcam';
                })
                .catch(error => {
                    console.error('Error accessing webcam:', error);
                    updateStatus('Error accessing webcam. Please check permissions.');
                });
        } else {
            updateStatus('Webcam not supported in this browser.');
        }
    }
}

// Capture photo from webcam
function capturePhoto() {
    if (webcamStream) {
        const context = canvas.getContext('2d');
        // Set canvas dimensions to match video
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        // Draw video frame to canvas
        context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        // Convert to data URL
        imageData = canvas.toDataURL('image/png');
        displayImage(imageData);
        
        // Close webcam automatically after capturing photo
        toggleWebcam();
    }
}

// Process the image for caption generation
function processImage() {
    if (!imageData) {
        updateStatus('Please upload an image or capture from webcam first.');
        return;
    }
    
    // Show loading state
    showElement(loading);
    hideElement(processButton);
    updateStatus('Processing image...');
    
    // Reset captions
    allCaptions = {};
    currentLanguage = 'English';
    
    // Convert base64 to blob for upload
    const blob = dataURLToBlob(imageData);
    const formData = new FormData();
    formData.append('image', blob, 'image.png');
    
    // Send image to backend for processing
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Store all captions in different languages
        allCaptions = data.captions;
        
        // Show the default English caption
        currentCaption = allCaptions['English'];
        captionText.textContent = currentCaption;
        
        // Enable copy button
        copyButton.disabled = false;
        
        // Highlight the English button to show it's active
        document.querySelectorAll('.language-btn').forEach(btn => {
            if (btn.dataset.langName === 'English') {
                btn.style.fontWeight = 'bold';
                btn.style.transform = 'scale(1.05)';
            } else {
                btn.style.fontWeight = 'normal';
                btn.style.transform = 'scale(1)';
            }
        });
        
        // Hide loading
        hideElement(loading);
        showElement(processButton);
        updateStatus('Caption generated! Select a language to see and hear it.');
        
        // Add to history with all language captions
        addToHistory(imageData, currentCaption, allCaptions);
    })
    .catch(error => {
        console.error('Error processing image:', error);
        updateStatus('Error: ' + error.message);
        hideElement(loading);
        showElement(processButton);
    });
}

// Convert dataURL to Blob
function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
}

// Generate speech from caption
function generateSpeech(languageCode, languageName) {
    if (!allCaptions[languageName]) {
        updateStatus('Please generate a caption first.');
        return;
    }
    
    const captionToRead = allCaptions[languageName];
    
    updateStatus(`Converting caption to speech in ${languageName}...`);
    
    // Get the translation for the selected language
    fetch('/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: captionToRead,
            language: languageName
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update audio player with the generated speech
        audioPlayer.src = data.audio_url;
        audioPlayer.disabled = false;
        downloadButton.disabled = false;
        
        // Hide loading
        hideElement(loading);
        updateStatus(`Audio generated in ${languageName}! You can play it or download it.`);
    })
    .catch(error => {
        console.error('Error generating speech:', error);
        updateStatus('Error: ' + error.message);
        hideElement(loading);
    });
}

// Copy caption to clipboard
function copyCaption() {
    if (captionText.textContent) {
        navigator.clipboard.writeText(captionText.textContent)
            .then(() => {
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                updateStatus('Failed to copy text to clipboard.');
            });
    }
}

// Download audio
function downloadAudio() {
    if (audioPlayer.src) {
        const a = document.createElement('a');
        a.href = audioPlayer.src;
        a.download = `caption_audio_${currentLanguage}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Add to history
function addToHistory(imageData, caption, allLanguageCaptions) {
    const historyItem = {
        id: Date.now(),
        image: imageData,
        caption: caption,
        allCaptions: allLanguageCaptions, // Save all language captions
        timestamp: new Date().toISOString()
    };
    
    history.unshift(historyItem);
    
    // Limit history to 10 items
    if (history.length > 10) {
        history.pop();
    }
    
    // Save to localStorage
    localStorage.setItem('icasgHistory', JSON.stringify(history));
    
    // Update history display
    renderHistory();
}

// Delete history item
function deleteHistoryItem(id, event) {
    // Stop the event from bubbling up to parent elements
    event.stopPropagation();
    
    // Find the item index
    const index = history.findIndex(item => item.id === id);
    if (index > -1) {
        // Remove the item
        history.splice(index, 1);
        
        // Save to localStorage
        localStorage.setItem('icasgHistory', JSON.stringify(history));
        
        // Update history display
        renderHistory();
        
        updateStatus('History item deleted');
    }
}

// Render history items
function renderHistory() {
    historyContainer.innerHTML = '';
    
    if (history.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No history yet. Process some images to see them here.';
        emptyMessage.style.color = 'white';
        historyContainer.appendChild(emptyMessage);
        return;
    }
    
    history.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.id = item.id;
        
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = 'History image';
        
        const caption = document.createElement('p');
        caption.className = 'history-caption';
        caption.textContent = item.caption;
        
        const date = document.createElement('small');
        date.textContent = new Date(item.timestamp).toLocaleString();
        date.style.display = 'block';
        date.style.marginTop = '5px';
        date.style.color = '#666';
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn delete-history-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.style.padding = '5px';
        deleteBtn.style.margin = '5px 0';
        deleteBtn.style.fontSize = '12px';
        deleteBtn.style.background = '#e74c3c';
        deleteBtn.addEventListener('click', (e) => deleteHistoryItem(item.id, e));
        
        historyItem.appendChild(img);
        historyItem.appendChild(caption);
        historyItem.appendChild(date);
        historyItem.appendChild(deleteBtn);
        
        // Add click event to restore this item
        historyItem.addEventListener('click', () => {
            imageData = item.image;
            displayImage(imageData);
            
            // Restore all captions in different languages
            if (item.allCaptions) {
                allCaptions = item.allCaptions;
                currentCaption = item.caption;
                captionText.textContent = currentCaption;
            } else {
                // Fallback for older history items
                currentCaption = item.caption;
                allCaptions = { 'English': item.caption };
                captionText.textContent = currentCaption;
            }
            
            copyButton.disabled = false;
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            updateStatus('Image and captions restored from history.');
        });
        
        historyContainer.appendChild(historyItem);
    });
}

// Toggle history visibility
function toggleHistory() {
    if (historyContainer.style.display === 'flex') {
        historyContainer.style.display = 'none';
        historyButton.innerHTML = '<i class="fas fa-history"></i> View History';
    } else {
        historyContainer.style.display = 'flex';
        historyButton.innerHTML = '<i class="fas fa-times"></i> Hide History';
    }
}

// Update status message
function updateStatus(message) {
    status.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
}

// Helper functions to show/hide elements
function showElement(element) {
    element.style.display = 'block';
}

function hideElement(element) {
    element.style.display = 'none';
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);