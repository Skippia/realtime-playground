let messages = [];

document.addEventListener('DOMContentLoaded', (event) => {
    subscribe();
});

// When connection goes down, we run it again
async function subscribe() {
    try {
        const response = await fetch('/get-messages');
        const data = await response.json();
        
        messages.unshift(data);
        
        renderMessages();
        
        await subscribe();
    } catch (e) {
        setTimeout(() => {
            subscribe();
        }, 500);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');

    if (messageInput.value.trim() === '') return;

    await fetch('/new-messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: messageInput.value,
            id: Date.now()
        }),
    });
    messageInput.value = '';
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';

    messages.forEach(mess => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.textContent = mess.message;
        container.appendChild(messageDiv);
    });
}
