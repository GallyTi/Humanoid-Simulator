document.addEventListener('DOMContentLoaded', function () {
  const model = document.querySelector('#model');
  const cursor = document.querySelector('#cursor');

  const jointSelector = document.getElementById('jointSelector');
  const xRotationInput = document.getElementById('xRotation');
  const yRotationInput = document.getElementById('yRotation');
  const zRotationInput = document.getElementById('zRotation');

  // Initialize recording status and the recorded rotations object
  let isRecording = false;
  let recordedRotations = {};
  let lastRecordingTime = null;
  let initialRotations = {};
  let jointRotations = {};
  let modelName = document.querySelector('#model').getAttribute('gltf-model').split('/')[1].split('.')[0];
  let resetButton = document.getElementById('resetButton');
  let models = [];
  let animations = [];
  let prevRotation = { x: 0, y: 0, z: 0 };
  let selectedJoint = null;




  // Get the record and play buttons
  const recordButton = document.getElementById('recordButton');
  const playButton = document.getElementById('playButton');
  const disableLimitsCheckbox = document.getElementById('disableLimitsCheckbox'); // new line

  // Event listener for disabling/enabling limits.
  disableLimitsCheckbox.addEventListener('change', function() {
    var checkboxes = document.querySelectorAll('input[type=range]');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].disabled = !this.checked;
    }
  });

  function rotateJoint(joint, rotation) {
    joint.rotation.x = rotation.x;
    joint.rotation.y = rotation.y;
    joint.rotation.z = rotation.z;
  }

  let jointLimits = {};


  fetch('/models')
  .then((response) => response.json())
  .then((models) => {
    const modelSelector = document.getElementById('modelSelector');
    models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model;
      option.text = model;
      modelSelector.appendChild(option);
    });
  });

  fetch('/animations')
  .then((response) => response.json())
  .then((allAnimations) => {
    const modelAnimations = allAnimations.filter(animation => animation.startsWith(modelName));
    const animationSelector = document.getElementById('animationSelector');
    modelAnimations.forEach((animation) => {
      const option = document.createElement('option');
      option.value = animation;
      option.text = animation;
      animationSelector.appendChild(option);
    });
  });

  fetch('/getAnimations')
  .then(response => response.json())
  .then(data => {
    animations = data.animations;
  })
  .catch((error) => {
    console.error('Error:', error);
  });


  // Add event listener for record button
  // Add event listener for record button
recordButton.addEventListener('click', () => {
  isRecording = !isRecording;
  recordButton.textContent = isRecording ? 'Stop Recording' : 'Start Recording';

  if (isRecording) {
      // Clear previous recordings and initial states
      recordedRotations = {};
      initialRotations = {};
      lastRecordingTime = Date.now();

      // Capture initial state of each joint
      model.object3D.traverse(function (object) {
          if (object.isBone) {
              initialRotations[object.name] = {
                  x: object.rotation.x,
                  y: object.rotation.y,
                  z: object.rotation.z,
              };
          }
      });
  } else if (Object.keys(recordedRotations).length > 0) {
      // If recording has stopped and there are recorded rotations, send them to the server
      fetch(`/upload/${modelName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelName: modelName,
          recordedRotations: recordedRotations,
        }),
      })
      .then((response) => response.json())
      .then((data) => {
          console.log('Success:', data);
      })
      .catch((error) => {
          console.error('Error:', error);
      });

      // Reset all joints to their initial state
      for (let jointName in initialRotations) {
          const joint = model.object3D.getObjectByName(jointName);
          if (joint) {
              joint.rotation.x = initialRotations[jointName].x;
              joint.rotation.y = initialRotations[jointName].y;
              joint.rotation.z = initialRotations[jointName].z;
          }
      }

      // Enable play button if there are recorded rotations
      playButton.disabled = false;
    }
  });

  modelSelector.addEventListener('change', function () {
    const modelFile = modelSelector.value; // Get the whole model file name
    modelName = modelFile.split('.')[0]; // Get the model name without extension
    const modelExtension = modelFile.split('.').pop(); // Get the file extension
    
    if (modelName) {
      // If the file extension is glb, use it. If not, fallback to gltf
      const finalModelExtension = modelExtension === 'glb' ? 'glb' : 'gltf';
      // load the model
      model.setAttribute('gltf-model', `models/${modelName}.${finalModelExtension}`);
    
      // fetch the corresponding limits file
      fetch(`/limits/${modelName}-limits.json`)
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error(`No limits file for ${modelName}`);
          }
        })
        .then((jointData) => {
          jointData.joints.forEach((joint) => {
            const { name, min, max } = joint;
            jointLimits[name] = {
              min: {
                x: min && min.rotation !== undefined ? min.rotation[0] : 0,
                y: min && min.rotation !== undefined ? min.rotation[1] : 0,
                z: min && min.rotation !== undefined ? min.rotation[2] : 0
              },
              max: {
                x: max && max.rotation !== undefined ? max.rotation[0] : 0,
                y: max && max.rotation !== undefined ? max.rotation[1] : 0,
                z: max && max.rotation !== undefined ? max.rotation[2] : 0
              }
            };
          });
  
          // Clear and populate the animation selector dropdown
          const animationSelector = document.getElementById('animationSelector');
          while (animationSelector.firstChild) {
            animationSelector.firstChild.remove();
          }
          const modelAnimations = animations.filter(animation => animation.startsWith(modelName));
          modelAnimations.forEach((animation) => {
            const option = document.createElement('option');
            option.value = animation;
            option.text = animation;
            animationSelector.appendChild(option);
          });
        })
        .catch((error) => console.error(error));
    }
  });

  function resetPosition() {
    for (let jointName in initialRotations) {
      const joint = model.object3D.getObjectByName(jointName);
      if (joint) {
        joint.rotation.x = initialRotations[jointName].x;
        joint.rotation.y = initialRotations[jointName].y;
        joint.rotation.z = initialRotations[jointName].z;
      }
    }
  }

  animationSelector.addEventListener('change', function () {
    const resetOnNewAnimation = document.getElementById('resetOnNewAnimation').checked;
    const animationName = animationSelector.value;
    if (resetOnNewAnimation) {
      resetPosition();
    }
    if (animationName) {
      fetch(`animations/${animationName}`)
        .then((response) => response.json())
        .then((animationData) => {
          // Store the animation data for later use
          recordedRotations = animationData;
          // Enable the play button
          playButton.disabled = false;
        });
    }
  });

  function populateAnimationMenu(animations, selectedModel) {
    const animationSelector = document.getElementById('animationSelector');
    const modelPrefix = selectedModel.split('.').slice(0, -1).join('.'); // Get the name of the model without the .gltf extension
  
    while (animationSelector.firstChild) {
      animationSelector.firstChild.remove();
    }
  
    animations
      .filter(animation => animation.startsWith(modelPrefix)) // Only include animations that start with the model's name
      .forEach((animation) => {
        const option = document.createElement('option');
        option.value = animation;
        option.textContent = animation;
        animationSelector.appendChild(option);
      });
  }
  
  document.getElementById('uploadModelForm').addEventListener('submit', function(e) {
    e.preventDefault();
  
    var formData = new FormData();
    formData.append('model', document.getElementById('modelFile').files[0]);
  
    fetch('/upload-model', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
  });

  document.getElementById('uploadLimitsForm').addEventListener('submit', function(e) {
    e.preventDefault();
  
    var formData = new FormData();
    formData.append('limits', document.getElementById('limitsFile').files[0]);
  
    fetch('/upload-limits', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
  });

  document.querySelector('#uploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
  
    const fileInput = document.querySelector('#animationFile');
    const file = fileInput.files[0];
  
    if (!file) {
      alert('Please select a file');
      return;
    }
  
    const formData = new FormData();
    formData.append('animation', file);
  
    fetch('/upload-animation', {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch((error) => console.error('Error:', error));
  });

  // Add event listener for play button
  playButton.addEventListener('click', () => {
    for (let jointName in recordedRotations) {
      const { rotation, time } = recordedRotations[jointName];
      const joint = model.object3D.getObjectByName(jointName);
      if (joint) {
        new TWEEN.Tween(joint.rotation)
          .to({ x: rotation[0], y: rotation[1], z: rotation[2] }, time * 4)
          .start();
      }
    }
  });

  model.addEventListener('model-loaded', function (event) {
    const mesh = event.detail.model;
    
    // Clear the joint selector
    while (jointSelector.firstChild) {
      jointSelector.removeChild(jointSelector.firstChild);
    }
  
    mesh.traverse(function (object) {
      if (object.isBone) {
        console.log('Joint name:', object.name);
  
        // Capture initial state of each joint
        initialRotations[object.name] = {
          x: object.rotation.x,
          y: object.rotation.y,
          z: object.rotation.z,
        };
  
        const option = document.createElement('option');
        option.value = object.name;
        option.text = object.name;
        jointSelector.appendChild(option);
      }
    });

    let selectedJoint = null;

    jointSelector.addEventListener('change', function () {
      const jointName = jointSelector.value;
      
      // Save the rotations of all joints
      model.object3D.traverse(function (object) {
        if (object.isBone) {
          jointRotations[object.name] = {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z
          };
        }
      });
      
      selectedJoint = jointName ? model.object3D.getObjectByName(jointName) : null;
      
      if (selectedJoint && jointLimits[selectedJoint.name]) {
        const limit = jointLimits[selectedJoint.name];
      
        xRotationInput.disabled = !disableLimitsCheckbox.checked && (limit.min.x === 0 && limit.max.x === 0);
        yRotationInput.disabled = !disableLimitsCheckbox.checked && (limit.min.y === 0 && limit.max.y === 0);
        zRotationInput.disabled = !disableLimitsCheckbox.checked && (limit.min.z === 0 && limit.max.z === 0);
      } else {
        const disabled = !disableLimitsCheckbox.checked;
        
        xRotationInput.disabled = disabled;
        yRotationInput.disabled = disabled;
        zRotationInput.disabled = disabled;
      }
      
      // Set the sliders to the joint's current rotation, or the saved rotation if it exists
      const rotation = jointRotations[selectedJoint.name] || { x: "0", y: "0", z: "0" };
      xRotationInput.value = rotation.x * (180 / Math.PI);
      yRotationInput.value = rotation.y * (180 / Math.PI);
      zRotationInput.value = rotation.z * (180 / Math.PI);
    });
    

    function updateRotation() {
      if (selectedJoint) {
        const xRotation = parseFloat(xRotationInput.value) * (Math.PI / 180);
        const yRotation = parseFloat(yRotationInput.value) * (Math.PI / 180);
        const zRotation = parseFloat(zRotationInput.value) * (Math.PI / 180);
    
        const newRotation = new THREE.Vector3(xRotation, yRotation, zRotation);
    
        rotateJoint(selectedJoint, newRotation);
    
        if (isRecording) {
          const now = Date.now();
          const timeElapsed = now - lastRecordingTime;
          lastRecordingTime = now;
    
          recordedRotations[selectedJoint.name] = {
            rotation: [newRotation.x, newRotation.y, newRotation.z],
            time: timeElapsed
          };
        }
      }
    }
    
    xRotationInput.addEventListener('input', updateRotation);
    yRotationInput.addEventListener('input', updateRotation);
    zRotationInput.addEventListener('input', updateRotation);
  });
});

function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
}
requestAnimationFrame(animate);