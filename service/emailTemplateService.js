const generateActivationEmail = (username, activationUrl) => {
  return `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f7f7f7; font-family: 'Comic Sans MS', sans-serif; color: #333;">
        <div style="background-color: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Pet Image -->
          <div style="text-align: center;">
            <img src="https://www.verywellmind.com/thmb/15xUglFOvLnNWygFwRyRiu6nIts=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/iStock-619961796-edit-59cabaf6845b3400111119b7.jpg" alt="Cute Pet" style="width: 100px; height: auto; border-radius: 50%; margin-bottom: 10px;" />
            <h2 style="color: #FF6F61; font-size: 24px;">Welcome to the Pet Shop!</h2>
          </div>
          
          <!-- Greeting Section -->
          <p style="font-size: 16px; line-height: 1.8; color: #555; text-align: center;">
            Woof! Hello <strong>${username}</strong>! 🐾
          </p>
          <p style="font-size: 16px; line-height: 1.8; color: #555; text-align: center;">
            Thank you for joining our pet-friendly platform! To activate your account and start exploring all the pawsome features, just click the button below:
          </p>
          
          <!-- Activation Button -->
          <div style="text-align: center; margin: 20px 0;">
            <a href="${activationUrl}" style="background-color: #FF6F61; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-size: 18px;">
              Activate Account 🐕
            </a>
          </div>
  
          <!-- Additional Message -->
          <p style="font-size: 16px; line-height: 1.8; color: #555; text-align: center;">
            If you didn’t sign up for this account, please ignore this email and keep enjoying your time with your pets! 🐱
          </p>
  
          <!-- Signature -->
          <p style="font-size: 16px; line-height: 1.8; color: #555; text-align: center;">
            Best wishes and tail wags,<br>
            The Pet Lover Team 🐾
          </p>
        </div>
  
        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
          <p style="margin: 0;">PetLovers Inc, 1234 Paw Lane, Animal City, Petland</p>
          <p style="margin: 0;">Want fewer emails? <a href="#" style="color: #FF6F61; text-decoration: none;">Unsubscribe here</a></p>
        </div>
      </div>
    `;
};

module.exports = {
  generateActivationEmail,
};
