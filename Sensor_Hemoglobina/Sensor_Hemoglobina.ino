#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include "MAX30105.h"
#include <Adafruit_MLX90614.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>

#define WIFI_SSID "Estudiantes"
#define WIFI_PASSWORD "EstWifi.0224"
//#define WIFI_SSID "FABRI"
//#define WIFI_PASSWORD "FABRICIOO2106199211"

#define API_KEY "AIzaSyCuqu7VXYwn_o5F6F-m0GwJbP0lZ4FW7lQ"
#define DATABASE_URL "hemoglobinaproy-default-rtdb.firebaseio.com"

MAX30105 particleSensor;
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
Adafruit_MPU6050 mpu;
LiquidCrystal_I2C lcd(0x27, 16, 2); 

long maxRojo = 0, minRojo = 1000000;
long maxIR = 0, minIR = 1000000;
long maxVerde = 0, minVerde = 1000000;

const int numLecturas = 10;
float lecturasHb[numLecturas];
float lecturasTemp[numLecturas];
int indiceLectura = 0;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
FirebaseJson jsonGlobal;

unsigned long tiempoInicio = 0;
const unsigned long intervaloMuestreo = 2000;

void setup() {
  Serial.begin(115200);

  Wire.begin(17, 16); 
  Wire1.begin(21, 22);

  lcd.init(); 
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Iniciando...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando WiFi...");
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  Serial.println(" [OK]");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Conectado");
  delay(1500); 

  String macDispositivo = WiFi.macAddress();
  Serial.print("Direccion MAC de este ESP32: ");
  Serial.println(macDispositivo);

  String macLcd = macDispositivo;
  macLcd.replace(":", "");

  for (int i = 15; i >= 0; i--) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Copie MAC (");
    lcd.print(i);
    lcd.print(")");
    
    lcd.setCursor(0, 1);
    lcd.print(macLcd);
    
    delay(1000);
  }

  lcd.clear();
  lcd.print("Configurando..."); 

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  Firebase.begin(&config, &auth);

  if (!particleSensor.begin(Wire1, I2C_SPEED_STANDARD)) {
    Serial.println("Error MAX30105");
    lcd.clear();
    lcd.print("Error MAX30105");
  } else {
    particleSensor.setup(60, 4, 3, 100, 411, 4096);
  }
  
  if (!mpu.begin(0x68, &Wire1)) {
    Serial.println("Error MPU6050");
  }
  
  if (!mlx.begin(0x5A, &Wire)) {
    Serial.println("Error MLX90614");
  }

  delay(1500); 
  lcd.clear();
  lcd.print("Sistema Listo");
  lcd.setCursor(0, 1);
  lcd.print("Poner dedo...");
  
  tiempoInicio = millis();
}

void loop() {
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);

  if (abs(g.gyro.x) > 0.3 || abs(g.gyro.y) > 0.3 || abs(g.gyro.z) > 0.3) {
    if (indiceLectura > 0) {
      Serial.println("Movimiento detectado.");
      lcd.clear();
      lcd.print("No se mueva!");
      reiniciarVariables();
      delay(1500);
      lcd.clear();
      lcd.print("Poner dedo...");
    }
    return;
  }

  long valorRojo = particleSensor.getRed();
  long valorIR = particleSensor.getIR();
  long valorVerde = particleSensor.getGreen();

  if (valorIR < 50000) {
    if (indiceLectura > 0) {
      lcd.clear();
      lcd.print("Dedo retirado");
      reiniciarVariables();
      delay(1500);
      lcd.clear();
      lcd.print("Poner dedo...");
    }
    return;
  }

  if (valorRojo > maxRojo) maxRojo = valorRojo;
  if (valorRojo < minRojo) minRojo = valorRojo;
  
  if (valorIR > maxIR) maxIR = valorIR;
  if (valorIR < minIR) minIR = valorIR;
  
  if (valorVerde > maxVerde) maxVerde = valorVerde;
  if (valorVerde < minVerde) minVerde = valorVerde;

  if (millis() - tiempoInicio >= intervaloMuestreo) {
    float tempActual = mlx.readObjectTempC();
    float hbActual = calcularHemoglobina();

    if (tempActual < 28.0) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Temperatura");
      lcd.setCursor(0, 1);
      lcd.print("baja");
      reiniciarVariables();
      delay(1500);
      return;
    } else if (tempActual > 42.0) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Temperatura");
      lcd.setCursor(0, 1);
      lcd.print("alta");
      reiniciarVariables();
      delay(1500);
      return;
    }

    if (hbActual > 0) {
      lecturasHb[indiceLectura] = hbActual;
      lecturasTemp[indiceLectura] = tempActual;
      indiceLectura = indiceLectura + 1;
      
      Serial.print("Captura [");
      Serial.print(indiceLectura);
      Serial.print("/10] | Hb ");
      Serial.print(hbActual);
      Serial.print(" | T ");
      Serial.println(tempActual);
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Analisis "); 
      lcd.print(indiceLectura); 
      lcd.print("/10");
      lcd.setCursor(0, 1);
      lcd.print("Hb "); 
      lcd.print(hbActual, 1);
      lcd.print(" T "); 
      lcd.print(tempActual, 1);
    }

    if (indiceLectura >= numLecturas) {
      procesarYEnviarFinal();
      reiniciarVariables();
    }

    maxRojo = 0; minRojo = 1000000;
    maxIR = 0; minIR = 1000000;
    maxVerde = 0; minVerde = 1000000;
    tiempoInicio = millis();
  }
}

void reiniciarVariables() {
  indiceLectura = 0;
  maxRojo = 0; minRojo = 1000000;
  maxIR = 0; minIR = 1000000;
  maxVerde = 0; minVerde = 1000000;
  tiempoInicio = millis();
}

float calcularHemoglobina() {
  float dcRojo = (maxRojo + minRojo) / 2.0;
  float dcIR = (maxIR + minIR) / 2.0;
  
  float acRojoBruto = maxRojo - minRojo;
  float acIRBruto = maxIR - minIR;
  float acVerde = maxVerde - minVerde;

  float acRojo = acRojoBruto - acVerde;
  float acIR = acIRBruto - acVerde;

  if (acRojo < 0) acRojo = acRojoBruto;
  if (acIR < 0) acIR = acIRBruto;

  if (dcRojo > 0 && dcIR > 0) {
    float piRojo = acRojo / dcRojo;
    float piIR = acIR / dcIR;
    if (piIR > 0.0001) {
      float R = piRojo / piIR;
      float hb = 19.5 - (6.5 * R);
      if (hb > 20.0) hb = 20.0;
      if (hb < 5.0) hb = 5.0;
      return hb;
    }
  }
  return -1.0;
}

void procesarYEnviarFinal() {
  lcd.clear();
  lcd.print("Enviando...");

  float sumaCrudaHb = 0;
  float sumaCrudaTemp = 0;
  for(int i = 0; i < numLecturas; i++) {
    sumaCrudaHb = sumaCrudaHb + lecturasHb[i];
    sumaCrudaTemp = sumaCrudaTemp + lecturasTemp[i];
  }
  float promedioCrudoHb = sumaCrudaHb / numLecturas;
  float promedioCrudoTemp = sumaCrudaTemp / numLecturas;

  float sumaFiltradaHb = 0;
  float sumaFiltradaTemp = 0;
  int contValidos = 0;

  for(int i = 0; i < numLecturas; i++) {
    if (abs(lecturasHb[i] - promedioCrudoHb) <= 3.0 && abs(lecturasTemp[i] - promedioCrudoTemp) <= 2.0) {
      sumaFiltradaHb = sumaFiltradaHb + lecturasHb[i];
      sumaFiltradaTemp = sumaFiltradaTemp + lecturasTemp[i];
      contValidos = contValidos + 1;
    }
  }

  if (contValidos > 0) {
    float hbFinal = sumaFiltradaHb / contValidos;
    float tempFinal = sumaFiltradaTemp / contValidos;
    
    lcd.clear();
    lcd.print("Final Hb "); 
    lcd.print(hbFinal, 1);
    lcd.setCursor(0, 1);
    lcd.print("Final T "); 
    lcd.print(tempFinal, 1);
    
    String macDispositivo = WiFi.macAddress();
    macDispositivo.replace(":", ""); 
    
    String rutaFirebase = "/dispositivos_activos/";
    rutaFirebase = rutaFirebase + macDispositivo;

    jsonGlobal.clear();
    jsonGlobal.set("hemoglobina", hbFinal);
    jsonGlobal.set("temperatura", tempFinal);
    jsonGlobal.set("mensaje", "Exito");

    if (Firebase.RTDB.setJSON(&fbdo, rutaFirebase.c_str(), &jsonGlobal)) {
      Serial.println("Firebase actualizado con exito.");
      Serial.print("Datos guardados en el nodo: "); 
      Serial.println(rutaFirebase);
    } else {
      Serial.print("Error critico al subir a Firebase: "); 
      Serial.println(fbdo.errorReason());
    }
    
    delay(5000); 
  } else {
    lcd.clear();
    lcd.print("Error de lectura");
    delay(2000);
  }
}
