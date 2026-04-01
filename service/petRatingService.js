const Pets = require("../collection/Pets/model");
const User = require("../collection/Users/model");

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateRatingInput({ postBy, star, comment }) {
  if (!postBy || !star || !comment) {
    throw createHttpError(
      400,
      "Please provide complete information: postBy, star, comment."
    );
  }
  if (star < 1 || star > 5) {
    throw createHttpError(400, "The number of stars must be between 1 and 5.");
  }
}

async function getPetAndUserOrThrow({ petId, postBy }) {
  const [pet, user] = await Promise.all([Pets.findById(petId), User.findById(postBy)]);
  if (!pet) throw createHttpError(404, "Pet not found");
  if (!user) throw createHttpError(404, "user not found");
  return { pet, user };
}

function buildRatingPayload({ postBy, user, star, comment, feedback_img }) {
  return {
    postBy,
    username: user.username,
    avatar: user.Avatar,
    star,
    comment,
    dateComment: Date.now(),
    feedback_img,
  };
}

async function upsertPetRating({ petId, postBy, star, comment, newFiles }) {
  validateRatingInput({ postBy, star, comment });
  const { pet, user } = await getPetAndUserOrThrow({ petId, postBy });
  const existingRatingIndex = pet.rating.findIndex((r) => r.postBy.toString() === String(postBy));

  let feedback_img = newFiles;
  if (existingRatingIndex !== -1 && newFiles.length === 0) {
    const prev = pet.rating[existingRatingIndex].feedback_img || [];
    feedback_img = Array.isArray(prev) ? [...prev] : [];
  }

  const payload = buildRatingPayload({ postBy, user, star, comment, feedback_img });
  const action = existingRatingIndex !== -1 ? "updated" : "created";

  if (existingRatingIndex !== -1) {
    pet.rating[existingRatingIndex] = payload;
  } else {
    pet.rating.push(payload);
  }

  await pet.save();
  return { action, pet };
}

async function deletePetRating({ petId, postBy }) {
  const pet = await Pets.findById(petId);
  if (!pet) throw createHttpError(404, "Pet not found");

  const existingRatingIndex = pet.rating.findIndex((r) => r.postBy.toString() === String(postBy));
  if (existingRatingIndex === -1) throw createHttpError(404, "Rating not found");

  pet.rating.splice(existingRatingIndex, 1);
  await pet.save();
  return { pet };
}

module.exports = {
  upsertPetRating,
  deletePetRating,
};
