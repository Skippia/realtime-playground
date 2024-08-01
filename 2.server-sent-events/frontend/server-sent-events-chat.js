const messages = [];

document.addEventListener('DOMContentLoaded', () => {
  subscribe();
});

function subscribe() {
  const eventSource = new EventSource('/connect');

  eventSource.onmessage = (event) => {
    const message = JSON.parse(event.data);
    messages.unshift(message);
    renderMessages();
  };
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value;
  if (message.trim() === '') return;

  await fetch('/new-messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      id: Date.now()
    }),
  });
  input.value = '';
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
