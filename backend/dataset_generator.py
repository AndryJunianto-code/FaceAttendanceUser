import cv2
import os

CASC_PATH = 'haarcascade_frontalface_default.xml'
DATASET_PATH = 'dataset_foto/'
person_name = input("Enter NIP :") 
save_dir = DATASET_PATH+person_name
os.makedirs(save_dir, exist_ok=True)

cap = cv2.VideoCapture(0)

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

num_images_to_capture = 100
count = 0

while count < num_images_to_capture:
	ret, frame = cap.read() 
	if not ret:
		print("Failed to capture image")
		break

	gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)  
	faces = face_cascade.detectMultiScale(gray, 1.3, 5)  

	for (x, y, w, h) in faces:
		cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)

		face = frame[y:y+h, x:x+w]
		face_resized = cv2.resize(face, (200, 200))  

		face_filename = os.path.join(save_dir, f"face_{count+1}.jpg")
		cv2.imwrite(face_filename, face_resized)

		count += 1
		print(f"Captured image {count}")

    # Break loop on 'q' key press
	if cv2.waitKey(1) & 0xFF == ord('q') :
		break

	if count >= num_images_to_capture :
		print(f"Successfully captured {num_images_to_capture} images")
		break

# Release the webcam and close all windows
cap.release()
cv2.destroyAllWindows()