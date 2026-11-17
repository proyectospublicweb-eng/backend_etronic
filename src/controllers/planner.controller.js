import {
  createPlannerSubmission,
  listPlannerSubmissionsAdmin,
  updatePlannerSubmissionAdmin,
  deletePlannerSubmissionAdmin,
} from "../libs/plannerStore.js";

export async function postPlannerSubmission(req, res) {
  try {
    const {
      nombre,
      telefonoWhatsapp,
      totalSeleccionadas,
      resumenServicios,
      comentarios,
    } = req.body;

    const submission = await createPlannerSubmission({
      nombre,
      telefonoWhatsapp,
      totalSeleccionadas,
      resumenServicios,
      comentarios,
    });

    res.status(201).json({ submission });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getAdminPlannerSubmissions(req, res) {
  try {
    const data = await listPlannerSubmissionsAdmin();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function patchAdminPlannerSubmission(req, res) {
  try {
    const updated = await updatePlannerSubmissionAdmin(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Registro de planificador no encontrado" });
    }
    res.json({ submission: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteAdminPlannerSubmission(req, res) {
  try {
    const deleted = await deletePlannerSubmissionAdmin(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Registro de planificador no encontrado" });
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
