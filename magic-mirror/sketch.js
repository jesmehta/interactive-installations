let video;
let scl = 10; //try to stick to round numbers
let asciiChars = " .:-=+*#%@";
// let asciiChars = '`-_=+:;Il!i~^*"?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';
let interval = 100;

function setup() {
  createCanvas(640, 480); // Set the canvas size
  pixelDensity(1); // Ensure pixel density is set for accurate processing
  // scl = 10;

  video = createCapture(VIDEO); // Capture video from webcam
  video.size(width / scl, height / scl); // Reduce video size for performance
  video.hide(); // Hide the HTML video element

  angleMode(DEGREES);
  textSize(scl); // Set text size for ASCII characters
  textFont("Arial Black");
}

function draw() {
  background(0); // Set background color to black

  // Mirror the video feed
  // push(); // Save current drawing style settings and transformations
  translate(width, 0); // Move to the far right of the canvas
  scale(-1, 1); // Flip the x-axis backwards

  // let timeRec = frameCount % 10000;

  //Calling the image filter as a function

  let filterIndex = floor(frameCount / interval) % 5;
// filterIndex = 0;
  switch (filterIndex) {
    case 0:
      ellipseBnW(video);
      break;
    case 1:
      polyBnW(video);
      break;
    case 2:
      basicGridEllipse(video);
      break;
    case 3:
      asciiDisplay(video);
      break;
    case 4:
      basicGridText(video);
      break;
  }
  // pop(); // Restore original settings and transformations
}

//image filter functions

//ellipses based on brightness
function ellipseBnW(targImg) {
  targImg.loadPixels(); // Load current video frame pixels
  noStroke(); // No stroke for ellipses
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      // Calculate the index for the pixels array from x and y
      let index = (x + y * video.width) * 4;
      let r = targImg.pixels[index + 0];
      let g = targImg.pixels[index + 1];
      let b = targImg.pixels[index + 2];

      // Calculate brightness of the pixel
      let brightnessValue = (r + g + b) / 3;

      // Map brightness to ellipse radius
      let radius = map(brightnessValue, 0, 255, 0, 10);

      // Draw an ellipse at the corresponding position
      fill(255); // White ellipses
      ellipse(x * scl, y * scl, radius, radius); // Scale positions back up
    }
  }
}

//polygons based on brightness/colour
function polyBnW() {
  video.loadPixels(); // Load current video frame pixels
  noStroke();
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      // Calculate the index for the pixels array from x and y
      let index = (x + y * video.width) * 4;
      let r = video.pixels[index + 0];
      let g = video.pixels[index + 1];
      let b = video.pixels[index + 2];

      // Calculate brightness of the pixel
      let brightnessValue = (r + g + b) / 3;

      // Map brightness to ellipse radius
      let radius = map(brightnessValue, 0, 255, 0, scl / 2);
      let n = floor(map(brightnessValue, 0, 255, 3, 9));

      // Draw a polygon at the corresponding position
      // fill(255); // White shaoes
      fill(r, g, b); // Coloured shapes
      polygon(x * scl, y * scl, radius, n); // draw polygons using function
    }
  }
}

//to draw a polygon at x,y of size r and n no of sides
function polygon(x, y, r, n) {
  push();
  translate(x, y);

  beginShape();
  for (let i = 0; i < n; i++) {
    let x = r * cos((360 / n) * i);
    let y = r * sin((360 / n) * i);
    vertex(x, y);
    ellipse(x, y, 5, 5);
  }
  endShape(CLOSE);
  pop();
}

//to create a character-based display
function asciiDisplay(targImg) {
  background(255);
  targImg.loadPixels();
  //   video.loadPixels();
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      // Index to locate the pixel in the pixels array
      let index = (x + y * video.width) * 4;
      let r = targImg.pixels[index];
      let g = targImg.pixels[index + 1];
      let b = targImg.pixels[index + 2];
      let avg = (r + g + b) / 3; // Calculate average brightness

      // Map the brightness to the ASCII character index
      let charIndex = map(avg, 0, 255, asciiChars.length - 1, 0);
      charIndex = floor(charIndex);
      let char = asciiChars.charAt(charIndex);

      noStroke();
      // fill(0);    //black text
      fill(r, g, b); //coloured text
      // text('█', x * scl, y * scl); // Draw the character
      // fill(0);
      text(char, x * scl, y * scl); // Draw the character

      // // Calculate the mirrored x position for the character
      // let mirrorX = video.width - 1 - x;
      // // Display the ASCII character at the calculated position
      // text(char, mirrorX * scl, y * scl);
    }
  }
}

//to draw a basic grid of ellipses with pixel colour
function basicGridEllipse(targImg) {
  background(255);
  targImg.loadPixels();
  //   video.loadPixels();
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      // Index to locate the pixel in the pixels array
      let index = (x + y * video.width) * 4;
      let r = targImg.pixels[index];
      let g = targImg.pixels[index + 1];
      let b = targImg.pixels[index + 2];

      noStroke();
      fill(r, g, b);

      ellipse(x * scl, y * scl, scl, scl);
    }
  }
}

//to draw a basic grid of random text characters with pixel colour
function basicGridText(targImg) {
  background(255);
  targImg.loadPixels();
  //   video.loadPixels();
  for (let y = 0; y < video.height; y++) {
    for (let x = 0; x < video.width; x++) {
      // Index to locate the pixel in the pixels array
      let index = (x + y * video.width) * 4;
      let r = targImg.pixels[index];
      let g = targImg.pixels[index + 1];
      let b = targImg.pixels[index + 2];

      noStroke();
      fill(r, g, b);

      let randomLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[floor(random(26))];
      text(randomLetter, x * scl, y * scl); // Draw the character
    }
  }
}
