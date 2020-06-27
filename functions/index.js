const functions = require('firebase-functions');
const admin = require('firebase-admin');
const firebase = require('firebase');
const app = require('express')();
var serviceAccount = require("./serviceAccountKey.json");

var uuid4 = require('uuid4');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.databaseURL
});

const db = admin.firestore();

const config = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId,
    appId: process.env.appId,
    measurementId: process.env.measurementId
};


firebase.initializeApp(config);

const FBAuth = (req, res, next) => {
    let idToken;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({
            error: `Unauthorized`
        });
    }

    admin.auth().verifyIdToken(idToken).then(decodedToken => {
        req.user = decodedToken;
        return db.collection('users').where('userId', '==', req.user.uid).limit(1).get();
    }).then((data) => {
        console.log(data.docs)
        req.user.handle = data.docs[0].data().handle;
        return next();
    }).catch((err) => {
        console.error('Error while verifying token ', err);
        return res.status(403).json(err);
    })

}
app.get('/hotels', (request, response) => {
    db.
        collection('hotel').
        orderBy('createdAt', 'desc').
        get().
        then((data) => {
            let hotels = [];
            data.forEach((doc => {
                hotels.push(doc);
            }));
            return response.json(hotels);
        }).catch((err) => {
            console.error(err);
            return response.status(500).json({
                message: `Something went wrong`
            });
        })
})

app.get('/hotels/:id', FBAuth, (request, response) => {
    return db.collection('hotel').where('hotelId', '==', req.params.id).limit(1).get().then((data) => {
        return response.json(data.docs[0].data());
    }).catch((err) => {
        return res.status(500).json({
            message: `Something went wrong`
        });
    })
})

app.delete('/hotels/:id', FBAuth, (request, response) => {

    var hotel_query = db.collection('hotel').where('hotelId', '==', req.params.hotelid).limit(1).get();

    hotel_query.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });
})

app.post('/hotels', FBAuth, (request, response) => {

    const hotelObj = {
        name: request.body.name,
        roomCount: request.body.roomCount,
        hotelId: uuid4(),
        createdAt: new Date().toISOString()
    }
    db.collection('hotel').add(hotelObj).then((doc) => {
        return response.json({
            message: `document ${doc.id} created successfully`
        });
    }).catch((err) => {
        console.error(err);
        return response.status(500).json({
            message: `Something went wrong`
        });

    })
});

app.put('/hotels/:id', FBAuth, (request, response) => {

    return db.collection('hotel').where('hotelId', '==', req.params.id).limit(1).get().then((data) => {
        db.collection('hotel').doc(doc.id).set(req.body);
    }).catch((err) => {
        return res.status(500).json({
            message: `Something went wrong`
        });
    })
});

app.get('/reservations', (request, response) => {
    db.
        collection('reservations').
        orderBy('createdAt', 'desc').
        get().
        then((data) => {
            let reservations = [];
            data.forEach((doc => {
                reservations.push(doc);
            }));
            return response.json(reservations);
        }).catch((err) => {
            console.error(err);
            return response.status(500).json({
                message: `Something went wrong`
            });
        })
})

app.get('/reservations/:id', FBAuth, (request, response) => {
    return db.collection('reservations').where('reservationsId', '==', req.params.id).limit(1).get().then((data) => {
        return response.json(data.docs[0].data());
    }).catch((err) => {
        return res.status(500).json({
            message: `Something went wrong`
        });
    })
})

app.delete('/reservations/:id', FBAuth, (request, response) => {

    var reservations_query = db.collection('reservations').where('reservationsId', '==', req.params.reservationsid).limit(1).get();

    reservations_query.get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            doc.ref.delete();
        });
    });
})

app.post('/reservations', FBAuth, (request, response) => {

    const reservationObj = {
        user: request.user.uid,
        childCount: request.body.childCount,
        adultCount: request.body.adultCount,
        checkOutDate: request.body.checkOutDate,
        checkInDate: request.body.checkInDate,
        roomCount: request.body.roomCount,
        hotelId: uuid4(),
        createdAt: new Date().toISOString()
    }
    db.collection('reservations').add(reservationObj).then((doc) => {
        return response.json({
            message: `document ${doc.id} created successfully`
        });
    }).catch((err) => {
        console.error(err);
        return response.status(500).json({
            message: `Something went wrong`
        });

    })
});

app.put('/reservations/:id', FBAuth, (request, response) => {

    return db.collection('reservations').where('reservationsId', '==', req.params.id).limit(1).get().then((data) => {
        db.collection('reservations').doc(doc.id).set(req.body);
    }).catch((err) => {
        return res.status(500).json({
            message: `Something went wrong`
        });
    })
});

app.get('/availablehotels', (request, response) => {
    const filterParams = req.body;
    console.log(filterParams);

    let checkInDate = filterParams.checkInDate;
    let checkOutDate = filterParams.checkOutDate;
    let roomCount = filterParams.roomCount;
    let adultCount = filterParams.adultCount;
    let childCount = filterParams.childCount;

    let reservationList = [];
    let hotelList = [];
    let recommendedHotelList = [];

    db.
        collection('hotels').
        orderBy('createdAt', 'desc').
        get().
        then((data) => {
            let hotelList = [];
            data.forEach((doc => {
                hotelList.push(doc);
            }));
        }).catch((err) => {
            console.error(err);
            return response.status(500).json({
                message: `Something went wrong`
            });
        })

    db.
        collection('reservations').
        orderBy('createdAt', 'desc').
        get().
        then((data) => {
            let reservationList = [];
            data.forEach((doc => {
                reservationList.push(doc);
            }));
        }).catch((err) => {
            console.error(err);
            return response.status(500).json({
                message: `Something went wrong`
            });
        })

    reservationList.forEach((reservationObj) => {
        if (isReservationCompleted(reservationObj.checkInDate, reservationObj.checkOutDate, checkInDate, checkOutDate)) {
            hotelList.forEach((hotel, index) => {
                hotelList[index].roomCount -= reservationObj.roomCount;
            });
        }
    })

    hotelList.forEach((hotel) => {
        if (parseInt(hotel.roomCount) >= parseInt(roomCount)) {
            recommendedHotelList.push(hotel);
        }
    })

    return res.status(200).json(recommendedHotelList);


})

const isEmail = (email) => {
    var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

    if (email.match(re)) {
        return true;
    }
    return false;

}

const isEmpty = (string) => {
    if (string.trim() === '') {
        return true;
    }
    return false;
}
//Signup

app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    let errors = {}

    if (isEmpty(newUser.email)) {
        errors.email = 'Email must not be empty';
    } else if (!isEmail(newUser.email)) {
        errors.email = 'Must be a valid email address';
    }

    if (isEmpty(newUser.password)) {
        errors.password = 'Password must not be empty';
    } else if (newUser.password !== newUser.confirmPassword) {
        errors.password = 'Password and Confirm password must be matched';
    }

    if (isEmpty(newUser.handle)) {
        errors.handle = 'Handle must not be empty';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors);
    }
    let userId, idToken;
    db.doc(`/users/${newUser.handle}`).get().then(doc => {
        if (doc.exists) {
            return res.status(400).json({
                handle: 'this handle is already exists'
            })
        } else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
        }
    }).then(data => {
        userId = data.user.uid;
        return data.user.getIdToken();
    }).then(token => {
        idToken = token;
        const userCredential = {
            handle: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            userId
        }
        return db.doc(`/users/${newUser.handle}`).set(userCredential);

    }).then(
        () => {
            return res.status(201).json({
                idToken
            })
        }
    ).catch((err) => {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
            return res.status(400).json({
                email: "Email is already in use"
            })
        } else {
            return res.status(500).json({
                error: err.code
            })
        }

    })
})

app.post('/login', (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    }

    let errors = {}

    if (isEmpty(user.email)) {
        errors.email = 'Email must not be empty';
    } else if (!isEmail(user.email)) {
        errors.email = 'Must be a valid email address';
    }

    if (isEmpty(user.password)) {
        errors.password = 'Password must not be empty';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json(errors);
    }

    firebase.auth().signInWithEmailAndPassword(user.email, user.password).then((data) => {
        return data.user.getIdToken();
    }).then(token => {
        res.json({ token });
    }).catch((err) => {
        console.error(err);
        if (err.code === 'auth/wrong-password') {
            return res.status(403).json({
                genereal: "Wrong credentials, please try again"
            })
        } else {
            return res.status(500).json({
                error: err.code
            })
        }
    })
})

exports.api = functions.https.onRequest(app);

/**
 * Reservation filtering
 */
function isReservationCompleted(existingReservationFrom, existingReservationTo, newReservationFrom, newReservationTo) {

    var existingReservationFromDate, existingReservationToDate, newReservationFromDate, newReservationToDate;
    existingReservationFromDate = Date.parse(existingReservationFrom);
    existingReservationToDate = Date.parse(existingReservationTo);
    newReservationFromDate = Date.parse(newReservationFrom);
    newReservationToDate = Date.parse(newReservationTo);

    if ((newReservationFrom <= existingReservationTo && newReservationFrom >= existingReservationFrom)) {
        if ((newReservationTo <= existingReservationTo && newReservationTo >= existingReservationFrom)) {
            return true;
        }
    }
    return false;
}


exports.filterAvailableHotels = functions.https.onRequest((req, res) => {
    return cors(req, res, () => {
        if (req.method !== 'POST') {
            return res.status(401).json({
                message: 'Not Allowed'
            })
        }
        console.log(req.body);
        const filterParams = req.body;
        console.log(filterParams);

        let checkInDate = filterParams.checkInDate;
        let checkOutDate = filterParams.checkOutDate;
        let roomCount = filterParams.roomCount;
        let adultCount = filterParams.adultCount;
        let childCount = filterParams.childCount;

        let reservationList = [];
        let hotelList = [];
        let recommendedHotelList = [];

        hotelDocument.on('value', (snapshot) => {
            snapshot.forEach((obj) => {
                hotelList.push({
                    id: obj.key,
                    obj: obj.val()
                });
            });
        }, (error) => {
            return res.status(error.code).json({
                message: `Something went wrong. ${error.message}`
            })
        })

        reservationDocument.on('value', (snapshot) => {
            snapshot.forEach((obj) => {
                reservationList.push({
                    id: obj.key,
                    obj: obj.val()
                });
            });

            reservationList.forEach((reservationObj) => {
                if (isReservationCompleted(reservationObj.checkInDate, reservationObj.checkOutDate, checkInDate, checkOutDate)) {
                    hotelList.forEach((hotel, index) => {
                        hotelList[index].roomCount -= reservationObj.roomCount;
                    });
                }
            })

            hotelList.forEach((hotel) => {
                if (parseInt(hotel.roomCount) >= parseInt(roomCount)) {
                    recommendedHotelList.push(hotel);
                }
            })

        }, (error) => {
            return res.status(error.code).json({
                message: `Something went wrong. ${error.message}`
            })
        })
        return res.status(200).json(recommendedHotelList);
    })
})

