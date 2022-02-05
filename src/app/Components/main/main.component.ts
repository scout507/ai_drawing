import {AfterViewInit, Component} from '@angular/core';
import {saveAs} from "file-saver";
import * as tf from '@tensorflow/tfjs';


@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements AfterViewInit {
  model: any;
  mode = false; // false = 10 classes; true = 21 classes
  paintCanvas!: HTMLCanvasElement;
  context: any;
  x = 0;
  y = 0;
  isMouseDown = false;
  labels = ["apple", "campfire", "diamond", "donut", "face", "fish", "hand", "house", "pizza", "t-shirt"]
  minX = 1000;
  minY = 1000;
  maxX = 0;
  maxY = 0;
  canvasHeight = 400;
  canvasWidth = 400;
  rescalerOn = true;

  strokeLength = 15;
  smoothingON = false;
  canvasBackgroundHidden = true;

  /** this canvas is needed for edge smoothing */
  canvasBackground: any;

  contextBackground: any;
  xBackground = 0;
  yBackground = 0;
  minXBackground = 1000;
  minYBackground = 1000;
  maxXBackground = 0;
  maxYBackground = 0;


  /**
   * Sets all variables at the beginning of the session, adds all eventlisteners and load the tenserflow model.
   */
  ngAfterViewInit() {
    this.paintCanvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.context = this.paintCanvas.getContext('2d');

    this.canvasBackground = document.getElementById('canvas2') as HTMLCanvasElement;
    this.contextBackground = this.canvasBackground.getContext('2d');

    this.setupContext(this.context);
    this.setupContext(this.contextBackground);
    this.addEvents();
    this.minX = this.canvasWidth;
    this.minY = this.canvasHeight;

    this.minXBackground = this.canvasWidth;
    this.minYBackground = this.canvasHeight;
    this.loadModel("./assets/model.json").then();
  }

  /**
   * Loads the TensorFlow model.
   * @param path contains the path to the TenserFlow model
   */
  async loadModel(path: string) {
    this.model = await tf.loadLayersModel(path);
  }

  /**
   * Setzt die richtigen einstellungen vom Context des Canvas.
   * @param context contains the context of a canvas.
   */
  setupContext(context: any) {
    context.lineCap = 'round';
    context.lineWidth = 2;
    context.strokeStyle = "black";
    context.fillStyle = "white";
    context.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  /**
   * Adds the eventlisteners for painting in the canvas.
   */
  addEvents() {
    this.paintCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.paintCanvas.addEventListener('mousemove', this.drawLine.bind(this));
    this.paintCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.paintCanvas.addEventListener('mouseout', this.stopDrawing.bind(this));
  }

  /**
   * Triggerd when the user draw in the canvas.
   * Starts drawing in the canvas and remembers the coordinates.
   * @param event given by event listener.
   */
  startDrawing(event: any) {
    this.isMouseDown = true;
    [this.x, this.y] = [event.offsetX, event.offsetY];
    [this.xBackground, this.yBackground] = [event.offsetX, event.offsetY];
  }

  /**
   * Triggerd when the user no longer paints in the canvas.
   * Stop painting.
   */
  stopDrawing() {
    this.isMouseDown = false;
  }

  /**
   * Triggerd when the user has started painting and paints a line.
   * Starts painting a line in the "paintCanvas" and triggers the similar
   * sequence for the "canvasBackground".
   * Meanwhile, the coordinates are observed with the "trackValues" function.
   * @param event given by event listener.
   */
  drawLine(event: any) {
    if (this.isMouseDown) {
      const newX = event.offsetX;
      const newY = event.offsetY;

      this.drawLineBackground(newX, newY);

      this.trackValues(newX, newY);
      this.context.beginPath();
      this.context.moveTo(this.x, this.y);
      this.context.lineTo(newX, newY);
      this.context.stroke();
      this.x = newX;
      this.y = newY;
    }
  }

  /**
   * Draws a line only if the distance between the new and the old point is
   * is equal to or greater than the "strokeLength".
   * Paint a smoothed line in the "canvasBackground".
   * @param newX current X coordinate of the mouse pointer from the user in the canvas.
   * @param newY current Y coordinate of the mouse pointer from the user in the canvas.
   */
  drawLineBackground(newX: number, newY: number) {
    if (this.getDistance(this.xBackground, newX, this.yBackground, newY) >= this.strokeLength) {
      if (newX > this.maxXBackground) this.maxXBackground = newX;
      if (newX < this.minXBackground) this.minXBackground = newX;
      if (newY > this.maxYBackground) this.maxYBackground = newY;
      if (newY < this.minYBackground) this.minYBackground = newY;
      this.contextBackground.beginPath();
      this.contextBackground.moveTo(this.xBackground, this.yBackground);
      this.contextBackground.lineTo(newX, newY);
      this.contextBackground.stroke();
      this.xBackground = newX;
      this.yBackground = newY;
    }
  }

  /**
   * Evaluates the user's drawn image.
   * If the user has not painted, the method is cancelled.
   * Depending on the activated filter, the "paintCanvas" or the "canvasBackground" is used
   * and the size of the canvas or the size of the image (resize) is used.
   * The image is then extracted from the canvas and resized to the appropriate size of the model (255x255 px).
   * At the end, the result is evaluated and displayed to the user.
   => Which category does the picture belong to, how sure is the model.
   */
  evaluate() {
    if (this.maxX == 0) {
      document.getElementById("output")!.innerHTML = "";
      return
    }

    let canvasToEvaluate: HTMLCanvasElement;

    if (this.smoothingON) canvasToEvaluate = this.canvasBackground;
    else canvasToEvaluate = this.paintCanvas;

    if (this.rescalerOn) canvasToEvaluate = this.cropImageFromCanvas(canvasToEvaluate, this.smoothingON);

    let inputTensor = tf.browser.fromPixels(canvasToEvaluate, 3)
      .resizeBilinear([255, 255])
      .reshape([1, 255, 255, 3])
      .cast('float32');
    let predictionResult = this.model.predict(inputTensor).dataSync();
    let recognizedDigit = predictionResult.indexOf(Math.max(...predictionResult));
    let sum = 0;

    predictionResult.forEach((prediction: number) => {
      if (prediction > 0) sum += prediction;
    })

    this.resultList(predictionResult, sum);

    if (sum == 0)
      document.getElementById("output")!.innerHTML = "Not recognised";
    else
      document.getElementById("output")!.innerHTML = this.labels[recognizedDigit] + "  " + Math.round(predictionResult[recognizedDigit] * 100 / sum) + "%";
  }

  /**
   * Saves the largest and smallest value of x and y, from the actual drawing.
   * @param x x Coordinate in the canvas
   * @param y y Coordinate in the canvas
   */
  trackValues(x: number, y: number) {
    if (x > this.maxX) this.maxX = x;
    if (x < this.minX) this.minX = x;
    if (y > this.maxY) this.maxY = y;
    if (y < this.minY) this.minY = y;
  }

  /**
   * Creates a new canvas that resizes to and includes the image in the passed canvas.
   * @param canvas
   * @param background is the given canvas the "canvasBackground".
   * @return HTMLCanvasElement the new resized canvas
   */
  cropImageFromCanvas(canvas: HTMLCanvasElement, background: boolean): HTMLCanvasElement {

    const resultCanvas: HTMLCanvasElement = document.createElement("canvas");

    let cut = canvas.getContext("2d")!.getImageData(this.minX, this.minY, this.maxX, this.maxY);

    let w = 1 + this.maxX - this.minX;
    let h = 1 + this.maxY - this.minY;

    if (background) {
      w = 1 + this.maxXBackground - this.minXBackground;
      h = 1 + this.maxYBackground - this.minYBackground;
      cut = canvas.getContext("2d")!.getImageData(this.minXBackground, this.minYBackground, this.maxXBackground, this.maxYBackground);
    }


    if (w > h) {
      resultCanvas.width = w;
      resultCanvas.height = w;
    } else {
      resultCanvas.width = h;
      resultCanvas.height = h;
    }
    resultCanvas.getContext("2d")!.putImageData(cut, 0, 0);
    return resultCanvas;
  }

  /**
   * Logs the various results from the "this.model" in the console.
   * @param results results from the prediction from "this.model"
   * @param sum sum of all positive results from "this.model" prediction
   */
  resultList(results: any, sum: number) {
    console.log("Results:")
    for (let i = 0; i < results.length; i++) {
      if (results[i] > 0) console.log(this.labels[i] + ": " + results[i] + "  Accuracy: " + (results[i] / sum));
    }
  }

  /**
   * Resets all values so that the user can start drawing from the beginning.
   */
  clear() {
    this.maxX = 0;
    this.maxY = 0;
    this.minX = this.canvasWidth;
    this.minY = this.canvasHeight;

    this.maxXBackground = 0;
    this.maxYBackground = 0;
    this.minXBackground = this.canvasWidth;
    this.minYBackground = this.canvasHeight;

    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.contextBackground.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    document.getElementById("output")!.innerHTML = "";
  }

  /**
   * Triggered when the user presses the download button.
   * Download the drawn image with the filters activated as a png.
   * The filename is adapted to the activated filters.
   */
  download() {
    let canvasToEvaluate: HTMLCanvasElement;
    let filename = "image"
    if (this.smoothingON) {
      canvasToEvaluate = this.canvasBackground;
      filename += "_smo"
    } else canvasToEvaluate = this.paintCanvas;

    if (this.rescalerOn) {
      filename += "_re"
      canvasToEvaluate = this.cropImageFromCanvas(canvasToEvaluate, this.smoothingON);
    }

    canvasToEvaluate.toBlob((blob: any) => {
      saveAs(blob, filename + ".png")
    });
  }

  /**
   * Calculates the distance between two points.
   * @param x1 x Coordinate of the first point
   * @param x2 x Coordinate of the second point
   * @param y1 y Coordinate of the first point
   * @param y2 y Coordinate of the second point
   * @return number returns the distance
   */
  getDistance(x1: number, x2: number, y1: number, y2: number):
    number {
    let x = x1 - x2;
    let y = y1 - y2;
    return Math.sqrt((x * x + y * y));
  }

  /**
   * This change the TenserFlow model and the list of available categories.
   */
  changeModel() {
    this.mode = !this.mode;

    if (this.mode) {
      this.loadModel("./assets/advanced/model.json").then();
      this.labels = ["apple", "baseball", "bicycle", "campfire", "car", "cup", "diamond", "donut", "elephant", "face", "fish", "foot", "hand", "house", "key", "mountain", "pants", "pizza", "snowman", "t-shirt", "tree"]
      document.getElementById("list")!.innerHTML =
        "You can draw:<br><br>\n" +
        "Apple<br>\n" +
        "Face<br>\n" +
        "Pizza<br>\n" +
        "Campfire<br>\n" +
        "Diamond<br>\n" +
        "Donut<br>\n" +
        "Fish<br>\n" +
        "Hand<br>\n" +
        "House<br>\n" +
        "T-Shirt<br>\n" +
        "baseball<br>\n" +
        "bicycle<br>\n" +
        "car<br>\n" +
        "cup<br>\n" +
        "elephant<br>\n" +
        "foot<br>\n" +
        "key<br>\n" +
        "mountain<br>\n" +
        "pants<br>\n" +
        "snowman<br>\n" +
        "tree";
    } else {
      this.loadModel("./assets/model.json").then();
      this.labels = ["apple", "campfire", "diamond", "donut", "face", "fish", "hand", "house", "pizza", "t-shirt"]
      document.getElementById("list")!.innerHTML =
        "You can draw:<br><br>\n" +
        "Apple<br>\n" +
        "Face<br>\n" +
        "Pizza<br>\n" +
        "Campfire<br>\n" +
        "Diamond<br>\n" +
        "Donut<br>\n" +
        "Fish<br>\n" +
        "Hand<br>\n" +
        "House<br>\n" +
        "T-Shirt";
    }
  }
}
