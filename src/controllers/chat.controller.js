import {
  addVisitorChatMessage,
  getConversationBySessionKey,
  listAllChatConversations,
  updateChatConversationByAdmin,
  addAdminChatReply,
  deleteChatConversationByAdmin,
} from "../libs/chatStore.js";

export const postVisitorMessage = async (req, res) => {
  try {
    const conversation = await addVisitorChatMessage(req.body);
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getVisitorSession = async (req, res) => {
  try {
    const conversation = await getConversationBySessionKey(
      req.params.sessionKey
    );
    if (!conversation) {
      return res.json({ conversation: null });
    }
    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminChats = async (req, res) => {
  try {
    const data = await listAllChatConversations();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const patchAdminChat = async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "ID de conversación inválido" });
  }

  try {
    const updated = await updateChatConversationByAdmin(targetId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const postAdminChatReply = async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "ID de conversación inválido" });
  }

  try {
    const updated = await addAdminChatReply(targetId, req.body.mensaje);
    if (!updated) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAdminChat = async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "ID de conversación inválido" });
  }

  try {
    const ok = await deleteChatConversationByAdmin(targetId);
    if (!ok) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }
    res.json({ id: targetId, message: "Conversación eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
