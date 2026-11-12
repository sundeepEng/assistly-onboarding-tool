export const GenerateRandomPassword = (length: number = 14): string => {

  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const symbols = "@$!%*&";
  const allChars = lowercase + uppercase + digits + symbols;

  // Ensure at least one character from each category
  const passwordArray = [
    lowercase[Math.floor(Math.random() * lowercase.length)],
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  // Fill the rest of the password with random characters from all categories
  for (let i = 4; i < length; i++) {
    const randomChar = allChars[Math.floor(Math.random() * allChars.length)];
    passwordArray.push(randomChar);
  }

  // Shuffle the password to randomize the order of characters
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join("");
};
