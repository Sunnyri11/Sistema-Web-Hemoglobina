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

// Cambiado a 10 lecturas
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
  delay(1500); // Pausa para que el usuario alcance a leer el mensaje

  // ---------------------------------------------------------
  // MOSTRAR MAC EN PANTALLA LCD CON CUENTA REGRESIVA (15s)
  // ---------------------------------------------------------
  String macDispositivo = WiFi.macAddress();
  Serial.print("Direccion MAC de este ESP32: ");
  Serial.println(macDispositivo);

  // Crear una version sin dos puntos para que quepa en la LCD
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
  lcd.print("Configurando..."); // Mensaje mientras inician los sensores
  // ---------------------------------------------------------
