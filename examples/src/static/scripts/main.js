// World Clock Feature
// Updates clocks for different time zones every second

/**
 * Updates all world clocks with current time
 */
function updateWorldClocks() {
    const now = new Date();

    // Time zone configurations
    const timeZones = {
        'clock-newyork': 'America/New_York',
        'clock-london': 'Europe/London',
        'clock-tokyo': 'Asia/Tokyo',
        'clock-local': undefined // Local time zone
    };

    // Update each clock
    Object.keys(timeZones).forEach((clockId) => {
        const element = document.getElementById(clockId);
        if (element) {
            const timeZone = timeZones[clockId];
            const options = {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: timeZone
            };

            try {
                const timeString = now.toLocaleTimeString('en-US', options);
                element.textContent = timeString;
            } catch (error) {
                console.error(`Error updating clock ${clockId}:`, error);
                element.textContent = 'Error';
            }
        }
    });
}

// Initialize clocks when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClocks);
} else {
    initializeClocks();
}

function initializeClocks() {
    // Update clocks immediately
    updateWorldClocks();

    // Update clocks every second
    setInterval(updateWorldClocks, 1000);
}
