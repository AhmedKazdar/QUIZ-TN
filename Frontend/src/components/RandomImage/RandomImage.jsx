import React from "react";

// Array of image paths (make sure to import the images correctly)
import img1 from "../../assets/random/carthage.png";
import img2 from "../../assets/random/MG.png";
import img3 from "../../assets/random/movenpick.png";

const images = [img1, img2, img3];

const RandomImage = () => {
  // Select a random image
  const randomImage = images[Math.floor(Math.random() * images.length)];

  return (
    <div>
      <img
        src={randomImage}
        alt="Random"
        style={{
          width: "600px",
          height: "300px",
          objectFit: "cover",
          borderRadius: "8px",
          marginTop: "5px",
        }}
      />
    </div>
  );
};

export default RandomImage;
