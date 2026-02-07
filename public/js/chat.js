/* ═══════════════════════════════════════════════════════════════
   DECODE THE NUMBER — CHAT MODULE
   Real-time chat with emoji support & message reactions
   ═══════════════════════════════════════════════════════════════ */

const Chat = (() => {
  let socket = null;
  let mySocketId = null;
  let isOpen = false;
  let unreadCount = 0;

  const reactionEmojis = ['👍', '😂', '🔥', '😎', '🤔', '❤️'];

  function init(socketInstance, myId) {
    socket = socketInstance;
    mySocketId = myId;
    bindEvents();
    bindSocketEvents();
  }

  function updateMyId(id) {
    mySocketId = id;
  }

  function bindEvents() {
    // Toggle chat
    document.getElementById('chatToggleBtn').addEventListener('click', () => {
      SFX.tap();
      toggleChat();
    });
    document.getElementById('chatCloseBtn').addEventListener('click', () => {
      SFX.tap();
      closeChat();
    });

    // Send message
    document.getElementById('btnSendChat').addEventListener('click', () => sendMessage());
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Emoji bar – insert emoji into input
    document.querySelectorAll('#emojiBar .emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('chatInput');
        input.value += btn.dataset.emoji;
        input.focus();
        SFX.tap();
      });
    });
  }

  function bindSocketEvents() {
    socket.on('chatMessage', (msg) => {
      appendMessage(msg);
      if (msg.senderSocketId !== mySocketId) {
        SFX.chatMsg();
        if (!isOpen) {
          unreadCount++;
          updateBadge();
        }
      }
    });

    socket.on('chatReactionUpdate', ({ messageId, reactions }) => {
      updateReactions(messageId, reactions);
    });
  }

  function toggleChat() {
    const panel = document.getElementById('chatPanel');
    if (isOpen) {
      closeChat();
    } else {
      panel.classList.remove('hidden');
      isOpen = true;
      unreadCount = 0;
      updateBadge();
      document.getElementById('chatInput').focus();
    }
  }

  function closeChat() {
    document.getElementById('chatPanel').classList.add('hidden');
    isOpen = false;
  }

  function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    socket.emit('chatMessage', { text });
    input.value = '';
    SFX.tap();
  }

  function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    // Remove empty state
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const isMine = msg.senderSocketId === mySocketId;
    const div = document.createElement('div');
    div.className = `chat-msg ${isMine ? 'mine' : 'theirs'}`;
    div.dataset.msgId = msg.id;

    const time = new Date(msg.timestamp);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build reaction picker
    const reactionPickerHTML = reactionEmojis.map(e =>
      `<button onclick="Chat.addReaction('${msg.id}','${e}')">${e}</button>`
    ).join('');

    div.innerHTML = `
      ${!isMine ? `<div class="chat-msg-sender">${escapeHTML(msg.sender)}</div>` : ''}
      <div class="chat-msg-text">${escapeHTML(msg.text)}</div>
      <div class="chat-msg-time">${timeStr}</div>
      <div class="chat-msg-reactions" id="reactions-${msg.id}"></div>
      <div class="reaction-picker">${reactionPickerHTML}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Render existing reactions
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
      updateReactions(msg.id, msg.reactions);
    }
  }

  function addReaction(messageId, emoji) {
    socket.emit('chatReaction', { messageId, emoji });
    SFX.tap();
  }

  function updateReactions(messageId, reactions) {
    const el = document.getElementById(`reactions-${messageId}`);
    if (!el) return;
    el.innerHTML = '';
    for (const [emoji, users] of Object.entries(reactions)) {
      if (users.length === 0) continue;
      const pill = document.createElement('span');
      pill.className = 'reaction-pill';
      pill.textContent = `${emoji} ${users.length}`;
      pill.onclick = () => addReaction(messageId, emoji);
      el.appendChild(pill);
    }
  }

  function updateBadge() {
    const badge = document.getElementById('chatBadge');
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function reset() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '<div class="chat-empty">Say hi to your opponent! 👋</div>';
    unreadCount = 0;
    updateBadge();
    closeChat();
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    updateMyId,
    addReaction,
    reset,
    toggleChat,
    closeChat
  };
})();
