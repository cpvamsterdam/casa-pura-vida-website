const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');
const crypto = require('crypto');

const DEFAULT_DATA = { chats: [] };

async function sendAdminEmail(chat, firstMessage) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ADMIN_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  if (!apiKey || !toEmail) return false;

  const siteUrl = process.env.URL || 'https://casapuravidanl.com';
  const replyLink = `${siteUrl}/chat-reply.html?chatId=${chat.id}&token=${chat.adminToken}`;
  const contactLine = chat.contactMethod === 'phone' ? `Phone: ${chat.contactValue}` : `Email: ${chat.contactValue}`;

  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      <h2 style="color:#193191;">New live chat - Casa Pura Vida</h2>
      <p><strong>${escapeHtml(chat.customerName)}</strong> started a chat.<br>${contactLine}</p>
      <p style="background:#F4F6FB; border-radius:10px; padding:14px; font-style:italic;">"${escapeHtml(firstMessage)}"</p>
      <a href="${replyLink}" style="display:inline-block; background:#193191; color:#fff; text-decoration:none; padding:12px 24px; border-radius:100px; font-weight:bold;">Open chat &amp; reply</a>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail, to: toEmail,
        subject: `New live chat from ${chat.customerName}`,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

exports.handler = async (event) => {
  const session = requireSession(event);
  const qs = event.queryStringParameters || {};

  if (event.httpMethod === 'GET') {
    const data = await getJSON('chats-data', DEFAULT_DATA);

    if (qs.action === 'list') {
      if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
      const summaries = data.chats.map(c => ({
        id: c.id, customerName: c.customerName, contactMethod: c.contactMethod,
        contactValue: c.contactValue, status: c.status, createdAt: c.createdAt, lastMessageAt: c.lastMessageAt,
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chats: summaries }) };
    }

    // Fetch a single chat's messages - used by both the customer widget and the admin reply page.
    const chatId = qs.chatId;
    if (!chatId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing chatId.' }) };
    const chat = data.chats.find(c => c.id === chatId);
    if (!chat) return { statusCode: 404, body: JSON.stringify({ error: 'Chat not found.' }) };
    // If a token is supplied, it must match (admin access); otherwise this is treated as the customer's own view.
    if (qs.token && qs.token !== chat.adminToken) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Invalid token.' }) };
    }
    // Mark as read by whichever side is viewing right now (skip this on silent background polls,
    // signalled with markRead=0, so read receipts only reflect the panel actually being open).
    if (qs.markRead !== '0') {
      const now = new Date().toISOString();
      if (qs.token) chat.lastReadByAdmin = now;
      else chat.lastReadByCustomer = now;
      await setJSON('chats-data', data);
    }
    const messages = await getJSON(`chat-messages:${chatId}`, []);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat: {
          customerName: chat.customerName, status: chat.status,
          lastReadByAdmin: chat.lastReadByAdmin || null,
          lastReadByCustomer: chat.lastReadByCustomer || null,
        },
        messages,
      }),
    };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }

    if (body.action === 'start') {
      const { customerName, contactMethod, contactValue, message } = body;
      if (!customerName || !contactMethod || !contactValue || !message) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
      }
      if (!['phone', 'email'].includes(contactMethod)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid contact method.' }) };
      }
      const data = await getJSON('chats-data', DEFAULT_DATA);
      const chatId = crypto.randomUUID();
      const adminToken = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      const chat = {
        id: chatId, customerName: String(customerName).slice(0, 100),
        contactMethod, contactValue: String(contactValue).slice(0, 150),
        adminToken, status: 'open', createdAt: now, lastMessageAt: now,
      };
      data.chats.push(chat);
      await setJSON('chats-data', data);
      await setJSON(`chat-messages:${chatId}`, [{ sender: 'customer', text: String(message).slice(0, 2000), timestamp: now }]);
      await sendAdminEmail(chat, message);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId }) };
    }

    if (body.action === 'send') {
      const { chatId, token, sender, text } = body;
      if (!chatId || !sender || !text) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
      }
      if (!['customer', 'admin'].includes(sender)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid sender.' }) };
      }
      const data = await getJSON('chats-data', DEFAULT_DATA);
      const chat = data.chats.find(c => c.id === chatId);
      if (!chat) return { statusCode: 404, body: JSON.stringify({ error: 'Chat not found.' }) };
      if (sender === 'admin' && token !== chat.adminToken) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Invalid token.' }) };
      }
      const messages = await getJSON(`chat-messages:${chatId}`, []);
      const now = new Date().toISOString();
      messages.push({ sender, text: String(text).slice(0, 2000), timestamp: now });
      await setJSON(`chat-messages:${chatId}`, messages);
      chat.lastMessageAt = now;
      await setJSON('chats-data', data);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'ok' }) };
    }

    if (body.action === 'close') {
      if (!session && body.token === undefined) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
      }
      const data = await getJSON('chats-data', DEFAULT_DATA);
      const chat = data.chats.find(c => c.id === body.chatId);
      if (!chat) return { statusCode: 404, body: JSON.stringify({ error: 'Chat not found.' }) };
      if (!session && body.token !== chat.adminToken) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Invalid token.' }) };
      }
      chat.status = 'closed';
      await setJSON('chats-data', data);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'ok' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action.' }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
