import {AfterViewInit, Component} from '@angular/core';
import {saveAs} from "file-saver";
import * as tf from '@tensorflow/tfjs';
import * as data from "../../../assets/model.json"
import test from "../../../assets/data/test.png"
import {model} from "@tensorflow/tfjs";


@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements AfterViewInit {
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

  constructor() {
  }

  ngAfterViewInit() {
    this.paintCanvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.context = this.paintCanvas.getContext('2d');
    this.context.lineCap = 'round';
    this.context.lineWidth = 2;
    this.context.strokeStyle = "black";
    this.context.fillStyle = "white";
    this.context.fillRect(0,0,this.paintCanvas.width,this.paintCanvas.height)
    this.addEvents();
    localStorage.setItem("tensorflowjs_models/model", JSON.stringify(data));
    this.minX = this.paintCanvas.width;
    this.minY = this.paintCanvas.height;
  }

  addEvents() {
    this.paintCanvas.addEventListener('mousedown', this.startDrawing.bind(this));
    this.paintCanvas.addEventListener('mousemove', this.drawLine.bind(this));
    this.paintCanvas.addEventListener('mouseup', this.stopDrawing.bind(this));
    this.paintCanvas.addEventListener('mouseout', this.stopDrawing.bind(this));
  }

  startDrawing(event: any) {
    this.isMouseDown = true;
    [this.x, this.y] = [event.offsetX, event.offsetY];
  }

  stopDrawing() {
    this.isMouseDown = false;
  }

  drawLine(event: any) {
    if (this.isMouseDown) {
      const newX = event.offsetX;
      const newY = event.offsetY;
      this.trackValues(newX,newY);
      this.context.beginPath();
      this.context.moveTo(this.x, this.y);
      this.context.lineTo(newX, newY);
      this.context.stroke();
      this.x = newX;
      this.y = newY;
      console.log(this.minX, this.maxX, this.minY, this.maxY);
    }
  }

  async evaluate() {

    let model: any = await tf.loadLayersModel("http://localhost:4200/assets/model.json");
    console.log(this.minX, this.maxX, this.minY, this.maxY);
    this.cropImageFromCanvas();
    let inputTensor = tf.browser.fromPixels(this.paintCanvas, 3)// imageResult is an <img/> tag
      .resizeBilinear([255,255])
      .reshape([1, 255, 255, 3])
      .cast('float32');
    let predictionResult =  model.predict(inputTensor).dataSync();
    let recognizedDigit = predictionResult.indexOf(Math.max(...predictionResult));
    let sum = 0;

    predictionResult.forEach((prediction:number) =>{
      if(prediction>0) sum += prediction;
    })

    this.resultList(predictionResult, sum);
    document.getElementById("output")!.innerHTML = this.labels[recognizedDigit] + "  " + Math.round(predictionResult[recognizedDigit]*100/sum) + "%";
  }

  trackValues(x: number, y: number){
    if(x > this.maxX) this.maxX = x;
    if(x < this.minX) this.minX = x;
    if(y > this.maxY) this.maxY = y;
    if(y < this.minY) this.minY = y;
  }

  cropImageFromCanvas() {
    const canvas = this.context.canvas;
    let w = 1 + this.maxX - this.minX;
    let h = 1 + this.maxY - this.minY;
    const cut = this.context.getImageData(this.minX, this.minY, this.maxX, this.maxY);
    this.context.lineWidth = 0.2;

    if(w > h) {
      canvas.width = w;
      canvas.height = w;
    }
    else{
      canvas.width = h;
      canvas.height = h;
    }
    this.context.putImageData(cut, 0, 0);
  }


  resultList(results: any, sum: number){
    console.log("Results:")
      for(let i = 0; i<results.length; i++){
          if(results[i]>0) console.log(this.labels[i]+ ": "+ results[i] + "  Accuracy: " + (results[i]/sum));
      }
  }

  clear() {
    this.context.fillRect(0,0,this.paintCanvas.width,this.paintCanvas.height)
    document.getElementById("output")!.innerHTML = "";
  }

  download() {
    this.paintCanvas.toBlob((blob: any) => {
      saveAs(blob, "image.png")
    });
  }
}
