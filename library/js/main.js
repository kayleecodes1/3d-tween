$(document).ready(function()
{
    // The viewport DOM element.
    var $viewport = $('#viewport'),
        viewportWidth = $viewport.width(),
        viewportHeight = $viewport.height();

    // Camera settings.
    var VIEW_ANGLE = 39.60,
        ASPECT = viewportWidth / viewportHeight,
        NEAR = 0.1,
        FAR = 10000;

    // Animation settings.
    var FPS = 30;
    var FRAME_MS = Math.floor(1000 / FPS);

    // Create the renderer, camera, and scene.
    var renderer = new THREE.WebGLRenderer({ antialiasing: true });
    renderer.setClearColor(0x000000);
    var camera =
      new THREE.PerspectiveCamera(
        VIEW_ANGLE,
        ASPECT,
        NEAR,
        FAR);
    var scene = new THREE.Scene();

    // Set up the window resize handling.
    THREEx.WindowResize(renderer, camera);

    // Add the camera to the scene and set it up.
    scene.add(camera);

    // Start the renderer.
    renderer.setSize(viewportWidth, viewportHeight);

    // Attach the DOM element supplied by the renderer to our viewport.
    $viewport.append(renderer.domElement);

    // Create the camera tracker mesh.
    var cam_tracker = createCameraTracker();
    // Create a camera tracker mesh and return it.
    function createCameraTracker()
    {
        var geo = new THREE.Geometry();
        var mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
        var cam_tracker = new THREE.Mesh( geo, mat );
        scene.add( cam_tracker );
        return cam_tracker;
    }

    // Create a triangle and return it.
    function createTriangle(width, imgUrl)
    {
        // Guarantees an equilateral triangle.
        var height = Math.floor((Math.sqrt(3) / 2) * width);

        var geo = new THREE.Geometry();
        var v1 = new THREE.Vector3(-(width / 2), height, 0);
        var v2 = new THREE.Vector3((width / 2), height, 0);
        var v3 = new THREE.Vector3(0,0,0);

        geo.vertices.push( v1 );
        geo.vertices.push( v2 );
        geo.vertices.push( v3 );

        geo.faces.push( new THREE.Face3(0,1,2) );
        geo.computeFaceNormals();

        // Create the material with the instagram image.
        var mat = new THREE.MeshBasicMaterial({
            map: THREE.ImageUtils.loadTexture( imgUrl ),
            side: THREE.DoubleSide,
            transparent: true,
            wireframe: false
        });

        // Set up the triangle's UV coordinates.
        geo.faceVertexUvs[0].push([
            new THREE.Vector2(0,1),
            new THREE.Vector2(1,1),
            new THREE.Vector2(.5,0)
        ]);

        // Create the triangle and add it to the scene.
        var tri = new THREE.Mesh( geo, mat );
        tri.doubleSided = true;
        tri.overdraw = true;
        scene.add( tri );

        return tri;
    }

    // Set up the animations with tween.js using the retrieved animation data.
    function setupAnimation(animName, imgUrl)
    {
        // Get animation data from JSON file.
        $.getJSON('library/data/'+animName+'.json', function(data) {
            
            // The duration of this animation.
            var duration = data.duration;

            // The array where all tweens for the animation will be stored.
            var tweens = [];

            // Set up the camera tweens.
            var camera_properties = {
                position:    {x:0,y:0,z:0},
                target:      {x:0,y:0,z:0},
                orientation: {x:0,y:0,z:0}
            };
            var camera_updates = {
                position:    updateCameraPosition,
                target:      updateCameraTarget,
                orientation: updateCameraOrientation
            }
            var camera_frameData = data.camera.frameData;
            var camera_tweens = buildTweens(camera_properties, camera_updates, camera_frameData);
            for(var i = 0; i < camera_tweens.length; i++)
            {
                tweens.push(camera_tweens[i]);
            }

            // Variables to keep track of "base" camera rotation. "Base" camera
            // rotation is the camera rotation before applying orientation
            // adjustments; that is, the rotation of the camera when only using
            // lookAt(). Orientation adjustments should be based on this.
            var goOrient = false;
            var lastTargetRotation = {
                x: camera.rotation.x,
                y: camera.rotation.y,
                z: camera.rotation.z
            };

            // Set up the initial properties of the camera.
            updateCameraPosition();
            updateCameraTarget();
            updateCameraOrientation();

            // Camera update functions.
            function updateCameraPosition()
            {
                var camera_position = camera_properties.position;
                camera.position.x = camera_position.x;
                camera.position.y = camera_position.y;
                camera.position.z = camera_position.z;
            }
            function updateCameraTarget()
            {
                var camera_target = camera_properties.target;
                camera.lookAt(
                    new THREE.Vector3(
                        camera_target.x,
                        camera_target.y,
                        camera_target.z ));
                goOrient = true;
                lastTargetRotation.x = camera.rotation.x;
                lastTargetRotation.y = camera.rotation.y;
                lastTargetRotation.z = camera.rotation.z;
            }
            var camera_up = new THREE.Vector3(0,1,0);
            function updateCameraOrientation()
            {
                var camera_orientation = camera_properties.orientation;
                if(goOrient)
                {
                    camera.rotation.x += camera_orientation.x * (Math.PI / 180);
                    camera.rotation.y += camera_orientation.y * (Math.PI / 180);
                    camera.rotation.z += camera_orientation.z * (Math.PI / 180);
                    goOrient = false;
                }
                else
                {
                    camera.rotation.x = lastTargetRotation.x + (camera_orientation.x * (Math.PI / 180));
                    camera.rotation.y = lastTargetRotation.y + (camera_orientation.y * (Math.PI / 180));
                    camera.rotation.z = lastTargetRotation.z + (camera_orientation.z * (Math.PI / 180));
                }
            }

            // The triangles for the current animation. Array of objects with
            // triangles[i].tri and triangles[i].properties properties.
            var triangles = [];

            // For each triangle create the triangle and set up tweens.
            for(var i = 0; i < data.triangles.length; i++)
            {
                // Create an entry for the triangle in the triangles array.
                triangles[i] = {};

                // Create the triangle.
                triangles[i].tri = createTriangle(data.triangles[i].width, imgUrl);

                // Set up the tweens for the triangle.
                triangles[i].properties = {
                    position:    {x:0,y:0,z:0},
                    rotation:    {x:0,y:0,z:0},
                    scale:       {x:0,y:0,z:0},
                    opacity:     {val:1.0}
                };
                var tri_updates = {
                    position:    createTriangleUpdateFunction(updateTrianglePosition, i),
                    rotation:    createTriangleUpdateFunction(updateTriangleRotation, i),
                    scale:       createTriangleUpdateFunction(updateTriangleScale, i),
                    opacity:     createTriangleUpdateFunction(updateTriangleOpacity, i),
                };
                var tri_frameData = data.triangles[i].frameData;
                var tri_tweens = buildTweens(triangles[i].properties, tri_updates, tri_frameData);
                for(var j = 0; j < tri_tweens.length; j++)
                {
                    tweens.push(tri_tweens[j]);
                }

                // Set up the initial properties of the triangle.
                updateTrianglePosition(i);
                updateTriangleRotation(i);
                updateTriangleScale(i);
                updateTriangleOpacity(i);
            }

            // Triangle update functions.
            function createTriangleUpdateFunction(func, static_index)
            {
                return function() { func(static_index); }
            }
            function updateTrianglePosition(index)
            {
                var tri = triangles[index].tri;
                var tri_position = triangles[index].properties.position;
                tri.position.x = tri_position.x;
                tri.position.y = tri_position.y;
                tri.position.z = tri_position.z;
            }
            function updateTriangleRotation(index)
            {
                var tri = triangles[index].tri;
                var tri_rotation = triangles[index].properties.rotation;
                tri.rotation.x = tri_rotation.x * (Math.PI / 180);
                tri.rotation.y = tri_rotation.y * (Math.PI / 180);
                tri.rotation.z = tri_rotation.z * (Math.PI / 180);
            }
            function updateTriangleScale(index)
            {
                var tri = triangles[index].tri;
                var tri_scale = triangles[index].properties.scale;
                tri.scale.x = tri_scale.x;
                tri.scale.y = tri_scale.y;
                tri.scale.z = tri_scale.z;
            }
            function updateTriangleOpacity(index)
            {
                var tri = triangles[index].tri;
                var tri_opacity = triangles[index].properties.opacity.val;
                tri.material.opacity = tri_opacity;
            }

            // Start the tweens.
            for(var i = 0; i < tweens.length; i++)
            {
                tweens[i].start();
            }
        });
    }
    setupAnimation('anim3', 'library/img/instagram1.jpg');

    // Helper function to build tweens for multiple properties. Takes the
    // properties object to be updated by the tweens, an object containing the
    // update functions for each property, and the frame data for the tweens.
    // Returns an array of the tweens that begin the chains.
    function buildTweens(properties, updates, frameData)
    {
        // Store the tweens that are at the beginning of chains in an array.
        var tweens = [];

        // Set up an object to store property history.
        var history_object = {};
        for(var p in properties)
        {
            history_object[p] =
            {
                previousFrame: -1,
                previousTween: null
            }
        }

        // Go through the frame data and build tweens for all the properties.
        for(var i = 0; i < frameData.length; i++)
        {
            var frame = frameData[i].frame;
            for(var p in properties)
            {
                if(frameData[i].hasOwnProperty(p))
                {
                    var currentAnimData = frameData[i][p];
                    // If there is no previous frame, set the initial state.
                    if(history_object[p].previousFrame == -1)
                    {
                        properties[p] = currentAnimData;
                    }
                    // Otherwise, create a new tween.
                    else
                    {
                        var new_tween = new TWEEN.Tween(properties[p])
                            .to(currentAnimData, (frame - history_object[p].previousFrame) * FRAME_MS)
                            .onUpdate(updates[p]);

                        // If there is a previous tween, chain this one after it.
                        if(history_object[p].previousTween !== null)
                        {
                            history_object[p].previousTween.chain(new_tween);
                        }
                        // If there is no previous tween, delay the tween so it
                        // starts at the first keyframe and store the tween in
                        // our tweens array since it will be the beginning of
                        // the chain.
                        else
                        {
                            new_tween.delay(history_object[p].previousFrame * FRAME_MS);

                            tweens.push(new_tween);
                        }

                        // Update the tween history.
                        history_object[p].previousTween = new_tween;
                    }

                    // Update the frame history.
                    history_object[p].previousFrame = frame;
                }
            }
        }

        // Return the tweens that start the animation chains.
        return tweens;
    }

    // Updates the scene at each tick.
    function updateScene()
    {
        // Update the objects in the scene based on our tweens.
        TWEEN.update();

        // Render the scene to the canvas.
        renderer.render(scene, camera);
    }

    // Set up the requestAnimFrame function.
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame    ||
              function( callback ){
                window.setTimeout(callback, 1000 / 60);
              };
    })();
    // The animation loop.
    (function animloop(){
        requestAnimFrame(animloop);
        updateScene();
    })();

    // Resize handling.
    /*$(window).resize(function()
    {
        var newWidth = $viewport.height(),
            newHeight = $viewport.width();
        renderer.setSize(newWidth, newHeight);
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
    });*/
});