import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween' // import plugin
  ; // import plugin
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button  from '@mui/material/Button';
import { Card, Fade, Modal, Paper, Stack } from '@mui/material';
import { _users } from 'src/_mock';
import { DashboardContent } from 'src/layouts/dashboard';
import Lottie from "lottie-react";
import successAnimation from '../../../../public/assets/success.json'; // Add your Lottie file here
import cameralogo from '../../../../public/assets/images/cameralogo.jpg';  // Import the image from the assets folder
/* import { applyFilter, getComparator } from '../utils';
import type { UserProps } from '../user-table-row'; */




const style = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 300,
  bgcolor: 'background.paper',
  borderRadius: '10px',
  boxShadow: 24,
  p: 4,
  textAlign: 'center',
};

export function UserView() {
  const webcamRef = useRef<Webcam | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [videoReady, setVideoReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Waiting for a stable face...');
  const [success, setSuccess] = useState<boolean>(true);
  const [geolocation,setGeolocation] = useState<string>('');
  const [userData, setUserData] = useState({name:"", userId:""});
  const [open, setOpen] = useState(false);
  const [attendedTime, setAttendedTime] = useState("");



  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false)

  const videoConstraints: MediaStreamConstraints = {
    video: {
      width: 1280,
      height: 720,
      facingMode: 'user',
    },
  };

  const processFrame = useCallback(async () => {

    const resetScanning = () => {
      setSuccess(false);
      setScanning(false);
      setStatus('Waiting for a stable face...');
      processFrame();
    };

    if (!scanning && webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setScanning(true);
        setStatus('Scanning...');

        try {
          const response = await fetch('http://localhost:5000/attendance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: imageSrc,
              geolocation,
            }),
          });

          const data = await response.json();
          console.log(data)
          setStatus(data.status);
          setUserData({userId: data.user_id, name: data.name})
          if (data.status.includes('Successful')) {
            setAttendedTime(dayjs().format('DD MMM YYYY, HH:mm:ss'));
            setSuccess(true);
            handleOpen();
          } else {
            setTimeout(() => {
              resetScanning();
            }, 1000);
          }
        } catch (error) {
          setStatus('Face recognition failed.');
          console.error('Error during recognition:', error);
          setTimeout(() => {
            resetScanning();
          }, 1000);
        }
      }
    }
  }, [scanning, geolocation]);

  const drawRectangle = useCallback(async () => {
    if(success) return;

    const video = webcamRef.current?.video;
    if (video && video.videoWidth > 0 && video.videoHeight > 0 && canvasRef.current) {
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const detect = async () => {
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions()
        );
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const canvas = canvasRef.current;
        if(canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          resizedDetections.forEach((detection) => {
            const { x, y, width, height } = detection.box;
            ctx.beginPath();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.rect(x, y, width, height);
            ctx.stroke();
          });
        } 
        }
       
        requestAnimationFrame(detect);
      };

      requestAnimationFrame(detect);
    } else {
      requestAnimationFrame(drawRectangle);
    }
  }, [webcamRef, canvasRef, success]);

  const handleVideoReady = () => setVideoReady(true);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setModelLoaded(true);
      } catch (err) {
        console.log('Error loading models:', err);
      }
    };

    loadModels();
  }, []);

  /* useEffect(() => {
    navigator.geolocation.getCurrentPosition((position) => {
      setGeolocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    });
  }, [setGeolocation]); */

  useEffect(() => {
    const intervalId = setInterval(() => {
      processFrame();
    }, 1000);
    return () => clearInterval(intervalId);
  }, [processFrame]);

  useEffect(() => {
    console.log(modelLoaded)
    console.log(videoReady)
    if (modelLoaded && videoReady) {
      drawRectangle();
    }
  }, [modelLoaded, videoReady, drawRectangle]);

  const buttonReset = () => {
    setUserData({name:'',userId:''});
    setSuccess(false);
    setScanning(false);
    setStatus('Waiting for a stable face...');
    processFrame();
    setVideoReady(true);
    setAttendedTime("")

    const canvas = canvasRef.current;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  processFrame();
  }

  return (
    <DashboardContent>
        
      <Box width='100%' style={{ position: 'relative', }}>
      {success ?  <Box width='640px' height='360px' display='flex' alignItems='center' justifyContent='center' color='black' sx={{backgroundColor:'black'}}>
        <img src={cameralogo} alt='cameralogo' /> </Box> : 
        <>
       <Webcam
        audio={false}
        ref={webcamRef}
        onUserMedia={handleVideoReady}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints.video}
        style={{ width: '640px', height: '360px'}}
      />
       <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '640px', height: '320px', transform:'translate(0,0)' }}
      />
      </>
      }
     
      <Typography variant="h6" color="textSecondary" mt='1rem'>
        {status} {status === "Attendance Successful" ? ` on ${attendedTime}` : ""}
      </Typography>

    
      <Stack direction='row' width="640px" alignItems='center' justifyContent='space-between' mt='1rem'>
      <Button style={{width:'40%', height:'6rem', marginRight:'1rem', fontSize:'18px'}} variant="contained" color="primary" onClick={buttonReset} sx={{ textTransform: 'capitalize' }} disabled={!success}>
          Take Attendance
      </Button>
      {userData.name && 
      <Paper
        sx={{
          padding: '10px',
          width: '60%',
          borderRadius: 2,
          boxShadow: 3,
          backgroundColor: '#ffffff', // White background
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height:'6rem'
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            marginBottom: 1,
            color: '#1976d2', // Primary blue color
          }}
        >
          {userData.name}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: '1.2rem',
            color: '#555555', // Text color for the ID
            fontWeight: '500',
          }}
        >
          ID : {userData.userId}
        </Typography>
      </Paper>}
      </Stack>
      
    </Box>
    <Modal open={open}
        onClose={handleClose}
        closeAfterTransition
        aria-labelledby="success-modal-title"
        aria-describedby="success-modal-description">
          <Fade in={open}>
          <Box sx={style}>
            {/* Animation Icon */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              {/* Use Lottie for animation */}
              <Lottie
                animationData={successAnimation}
                loop={false}
                style={{ height: 80 }}
              />

              {/* Fallback to Material Icon if Lottie isn't available */}
              {/* <CheckCircleOutlineIcon
                sx={{ fontSize: 80, color: 'green' }}
              /> */}
            </Box>

            {/* Success Text */}
            <Typography
              id="success-modal-title"
              variant="h6"
              component="h2"
              sx={{ mb: 1 }}
            >
              Attendance Successful!
            </Typography>
            <Typography
              id="success-modal-description"
              variant="body2"
              color="black"
            >
              {userData?.name} - {userData?.userId}
            </Typography>
            <Typography
              id="success-modal-description"
              variant="body2"
              color="black"
              sx={{ mb: 3 }}
            >
              {attendedTime}
            </Typography>

            {/* Manual Close Button */}
            <Button variant="outlined" color="primary" onClick={handleClose}>
              Close
            </Button>
          </Box>
        </Fade> 
    </Modal>
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

export function useTable() {
  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState('name');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const onSort = useCallback(
    (id: string) => {
      const isAsc = orderBy === id && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(id);
    },
    [order, orderBy]
  );

  const onSelectAllRows = useCallback((checked: boolean, newSelecteds: string[]) => {
    if (checked) {
      setSelected(newSelecteds);
      return;
    }
    setSelected([]);
  }, []);

  const onSelectRow = useCallback(
    (inputValue: string) => {
      const newSelected = selected.includes(inputValue)
        ? selected.filter((value) => value !== inputValue)
        : [...selected, inputValue];

      setSelected(newSelected);
    },
    [selected]
  );

  /* const onResetPage = useCallback(() => {
    setPage(0);
  }, []);

  const onChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const onChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      onResetPage();
    },
    [onResetPage]
  ); */

  return {
    page,
    order,
    onSort,
    orderBy,
    selected,
    rowsPerPage,
    onSelectRow,
    /* onResetPage, */
    /* onChangePage, */
    onSelectAllRows,
    /* onChangeRowsPerPage, */
  };
}
