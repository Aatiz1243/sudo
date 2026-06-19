// utils/response.js
export function createResponse({ title, description, color = 0x0099ff, footer = null }) {
  return {
    embeds: [{
      title,
      description,
      color,
      footer: footer ? { text: footer } : null
    }]
  };
}
