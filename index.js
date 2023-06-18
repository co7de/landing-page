// Load environment variables from .env file
require('dotenv').config();
// Import required modules
const express = require("express");
// const request = require('request');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
// const _ = require("lodash");
const path = require('path');
const mime = require('mime');
const multer = require('multer');
const shortid = require('shortid');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const pdf = require('html-pdf');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const {EventEmitter} = require('events');
const { promisify } = require('util');


// Create express application
const app = express();

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Middleware for parsing request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the "uploads" and "public" directories
app.use(express.static("uploads"));
app.use(express.static("public"));

// Set the views directory to "./views"
app.set('views', path.join(__dirname, 'views'));

// Configure EJS options
ejs.localsName = 'locals';
ejs.partials = {
    header: 'partials/header',
    footer: 'partials/footer'
};


// Serve static files for fonts, CSS, and bundles
app.use('/fonts', express.static(path.join(__dirname, 'public/css/fonts'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Content-Type', mime.getType(filePath));
    }
}));
app.use('/css', express.static(path.join(__dirname, 'public/css'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Content-Type', mime.getType(filePath));
    }
}));
app.use('/bundles', express.static(path.join(__dirname, 'public/bundles'), {
    setHeaders: function (res, path) {
        if (path.endsWith('.js')) {
            res.set('Content-Type', mime.getType(path));
        }
    }
}));

// Configure multer storage and file filter
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname + '/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const fileFilter = function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

// Create multer upload middleware
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Custom middleware for handling requests
app.use(async function (req, res, next) {
    try {
        // Variables for storing last uploaded photos
        let lastUploadedDoctorPhoto;

        // Retrieve last uploaded doctor photo
        const doctorPhotodocs = await DoctorPhoto.find({}).sort({ _id: -1 }).limit(1).exec();
        if (doctorPhotodocs.length > 0) {
            lastUploadedDoctorPhoto = path.basename(doctorPhotodocs[0].doctorPhoto);
        }


        // Retrieve necessary data from various collections using Promise.all()
        const [
            patients,
            invoices,
            doctor,
            clinic,
            settingSocialMedia,
            userPreferences,
            reviews,
            contacts
        ] = await Promise.all([
            Patient.find({}).exec(),
            Invoice.find({}).exec(),
            Doctor.find({}).exec(),
            Clinic.find({}).exec(),
            SettingSocialMedia.find({}).exec(),
            UserPreferences.find({}).exec(),
            Review.find({}).exec(),
            Contact.find({}).exec(),
        ]);

        // Get the language preference from user preferences or default to 'en'
        const language = (userPreferences[0] || {}).language || 'en';

        // Path to translation file
        const translationFilePath = path.join(__dirname, 'locales', language, 'translation.json');

        // Read translation file using promisify()
        const readFileAsync = promisify(fs.readFile);
        const data = await readFileAsync(translationFilePath, 'utf8');

        const translationFile = JSON.parse(data);

        // Set locals for rendering views
        res.locals = {
            lastUploadedDoctorPhoto: encodeURIComponent(lastUploadedDoctorPhoto),
            patients: patients.length > 0 ? patients : [],
            invoices: invoices.length > 0 ? invoices : [],
            doctor: doctor.length > 0 ? doctor[0] : null,
            clinic: clinic.length > 0 ? clinic[0] : null,
            settingSocialMedia: settingSocialMedia.length > 0 ? settingSocialMedia[0] : null,
            userPrefrences: userPreferences[0],
            contacts: contacts.length > 0 ? contacts : [],
            reviews: reviews.length > 0 ? reviews : [],
            translation: translationFile // Add the translationFile to res.locals
        };

        next();
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;

// This code sets up the necessary schemas and models for a MongoDB database using Mongoose
// to interact with the database and perform CRUD operations on the defined collections.
mongoose.set('strictQuery', false);
//
// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(process.env.MONGO_URI);
//         console.log(`MongoDB Connected ${conn.connection.host} `);
//     } catch (err) {
//         console.log(err);
//         process.exit(1);
//     }
// };
// const connectDB = async () => {
//     mongoose.connect("mongodb://127.0.0.1:27017/landingPageDB", {useNewUrlParser: true, useUnifiedTopology: true})
//         .then(() => {
//             console.log('Connected to MongoDB');
//         })
//         .catch((err) => {
//             console.error('Error connecting to MongoDB', err);
//         });
// };

mongoose.connect("mongodb://127.0.0.1:27017/landingPageDB", {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB', err);
    });


const eventEmitter = new EventEmitter();
const contactEventEmitter = new EventEmitter();
const contactEmitter = new EventEmitter();

const appointmentSchema = {
    idNumber: String,
    fName: String,
    lName: String,
    dateOfBirth: String,
    gender: String,
    service: String,
    date: String,
    time: String,
    email: String,
    tel: String,
    paragraph: String,

}
const Appointment = mongoose.model("appointment", appointmentSchema);

const approvedAppointmentSchema = {
    idNumber: String,
    fName: String,
    lName: String,
    service: String,
    date: String,
    time: String,
    tel: String,
}
const ApprovedAppointment = mongoose.model("ApprovedAppointment", approvedAppointmentSchema);

const deletedAppointmentSchema = {
    idNumber: String,
    fName: String,
    lName: String,
    service: String,
    date: String,
    time: String,
    tel: String,
}
const DeletedAppointment = mongoose.model("deletedAppointment", deletedAppointmentSchema);

const invoiceItemSchema = new mongoose.Schema({
    itemName: {type: String},
    description: {type: String},
    unitCost: {type: Number},
    quantity: {type: Number},
    total: {
        type: Number,
        get: function () {
            return this.unitCost * this.quantity;
        },
        set: function (total) {
            return this.total;
        },
    },
});
const InvoiceItem = mongoose.model('invoiceItem', invoiceItemSchema);

const invoiceSchema = {
    fullName: {type: String},
    email: {type: String},
    invoiceId: {type: String},
    status: {type: String},
    invoiceDate: {type: String},
    termsAndConditions: {type: String},
    items: [invoiceItemSchema],
    totalPrice: {type: Number},
    amountPaid: {type: Number},
    due: {type: Number},
    terms: {type: String},
}
const Invoice = mongoose.model('invoice', invoiceSchema);

const lastVisitSchema = {
    patientId: String,
    date: String,
    time: String,
    note: String,
    reason: String
};
const LastVisit = mongoose.model('lastVisit', lastVisitSchema);

const patientSchema = {
    idNumber: String,
    fName: String,
    lName: String,
    disease: String,
    tel: String,
    dateOfBirth: Date,
    age: String,
    time: String,
    gender: String,
    email: String,
    adress: String,
    status: String,
    lastVisit: [lastVisitSchema],
    invoices: [{type: mongoose.Schema.Types.ObjectId, ref: 'invoice'}],
}
const Patient = mongoose.model('patient', patientSchema);

const doctorSchema = new mongoose.Schema({
    idNumber: {
        type: String
    },
    fName: {
        type: String
    },
    lName: {
        type: String
    },
    password: {
        type: String
    },
    email: {
        type: String,
        unique: true
    },
    tel: {
        type: String
    },
    company: {
        type: String
    },
    companyWebsite: {
        type: String
    },
    specialty: {
        type: String
    },
    experience: {
        type: String
    },
    // doctorPhoto: {
    //     type: String
    // },
    address: {
        street: {
            type: String
        },
        city: {
            type: String
        },
        state: {
            type: String
        },
        zipCode: {
            type: String
        },
        country: {
            type: String
        },
        timeZone: {
            type: String
        }
    },
    reviews: [
        {
            title: {
                type: String
            },
            description: {
                type: String
            },
            rating: {
                type: Number
            },
            reviewerName: {
                type: String
            },
            reviewerEmail: {
                type: String
            }
        }
    ],
    schedule: [
        {
            day: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            },
            startTime: {
                type: String
            },
            endTime: {
                type: String
            }
        }
    ],
    appointments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        }
    ],
    clinic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic'
    }
});
const Doctor = mongoose.model('Doctor', doctorSchema);


const clinicSchema = {
    idNumber: {
        type: String
    },
    name: {
        type: String
    },
    address: {
        type: String
    },
    email: {
        type: String
    },
    phone: {
        type: String
    },
    state: {
        type: String
    },
    city: {
        type: String
    },
    clinicType: {
        type: String
    },
    clinicMessage: {
        type: String
    },
    // clinicLogo: {
    //     type: String
    // },
    altEmail: {
        type: String
    },
    password: {
        type: String
    },
    userName: {
        type: String
    },
    registrationEmail: {
        type: String
    },
    doctors: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor'
        }
    ],
    appointments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment'
        }
    ]
}
const Clinic = mongoose.model('clinic', clinicSchema);

const settingSocialMediaSchema = new mongoose.Schema({
    socialMedia: {
        facebook: {
            type: String
        },
        twitter: {
            type: String
        },
        linkedIn: {
            type: String
        }
    }
});
const SettingSocialMedia = mongoose.model('SettingSocialMedia', settingSocialMediaSchema);

const doctorPhotoSchema = {
    doctorPhoto: {
        type: String
    }
}
const DoctorPhoto = mongoose.model('doctorPhoto', doctorPhotoSchema);

const userPreferencesSchema = new mongoose.Schema({
    language: {
        type: String,
        default: 'en' // Default language
    },
    theme: {type: String},
    themeValue: {type: String},
    themeRtl: {type: Boolean},
    sidebarMini: {type: Boolean},
    font: {type: String},
    h_menu: {type: Boolean},
    headerFixed: {type: Boolean},
    headerDarkMode: {type: Boolean},
    borderRadios: {type: Number},
    sidebarDark: {type: Boolean},
    checkImage: {type: Boolean},
    pic: {type: String},
    fluidLayout: {
        type: Boolean,
        default: true,
    },
    cardShadow: {type: Boolean},
}, {timestamps: true});
const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

const reviewSchema = new mongoose.Schema({
    rating: {
        type: Number,
        required: true,
    },
    active: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        required: true,
    },
    profession: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    review: {
        type: String,
        required: true,
    },
    viewed: {
        type: String,
        default: false,
    },
});
const Review = mongoose.model('Review', reviewSchema);

const contactSchema = new mongoose.Schema({
    contacted: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    tel: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    viewed: {
        type: String,
        default: false,
    },
});
const Contact = mongoose.model('Contact', contactSchema);


// This code block sets up a route handler for the "/dashboard" URL path. It renders the "index" view and passes the current language from the request to the view.
app.get("/dashboard", async (req, res) => {
    try {
        // Retrieve the latest 10 invoices from the database
        const foundInvoices = await Invoice.find({}).limit(10).exec();

        // Find patients with invoices and populate their invoices
        const foundPatients = await Patient.find({ invoices: { $exists: true, $ne: [] } })
            .populate("invoices")
            .exec();
        // Render the 'index' view with the current language set from the request
        res.render('index', { currentLanguage: req.language, foundInvoices, foundPatients });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the root URL ("/"). It defines an array of hours and then retrieves active reviews from the database. It also generate
app.get('/', async (req, res) => {
    const hoursList = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    try {
        // Retrieve active reviews from the database and generate stars for each review
        const activeReviews = await Review.find({ active: true }).exec();
        const activeReviewsWithStars = activeReviews.map((review) => ({
            ...review.toObject(),
            stars: generateStars(review.rating),
        }));

        // Retrieve appointments from the database and render the "landing-page" view
        const foundAppointments = await Appointment.find({}).exec();
        res.render("landing-page", { hoursList, foundAppointments, activeReviewsWithStars });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/user/theme" URL path. It retrieves user preferences from the database and responds with JSON containing the theme.
app.get('/user/theme', async function (req, res) {
    try {
        // Retrieve user preferences from the database and respond with JSON containing the theme
        const userPreferences = await UserPreferences.find({}).exec();
        res.json({ theme: userPreferences[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

//This code block sets up a route handler for the "/api/invoices/:invoiceID" URL path. It retrieves an invoice from the database based on the provided invoice ID. If the invoice is found, it responds with the invoice data in JSON format. If the invoice is not found, it responds with a JSON error message and a 404 status code. If any error occurs during the process, it responds with a JSON error message and a 500 status code.
app.get('/api/invoices/:invoiceID', async (req, res) => {
    try {
        // Find an invoice by ID and respond with it if found; otherwise, respond with a 404 error
        const invoice = await Invoice.findOne({ _id: req.params.invoiceID }).exec();
        if (!invoice) {
            res.status(404).json({ message: 'Invoice not found' });
        } else {
            res.status(200).json(invoice);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//This code block sets up a route handler for the "/api/appointments/:id" URL path. It retrieves an appointment from the database based on the provided ID. It converts the appointment to a plain JavaScript object using the lean() method and responds with it in JSON format.
app.get('/api/appointments/:id', async (req, res) => {
    try {
        // Find an appointment by ID, convert it to a plain JavaScript object, and respond with it in JSON format
        const appointment = await Appointment.findById(req.params.id).lean().exec();
        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Unable to retrieve appointment data' });
    }
});

//This code block sets up a route handler for the "/switch-language/:lang" URL path. It updates the user's language preference based on the provided language parameter (lang). It retrieves the user preferences from the database, updates the language field, and saves the changes. Finally, it redirects the user to the "/dashboard" URL. If any error occurs during the process, it logs an error message and also redirects the user to the "/dashboard" URL.
app.get('/switch-language/:lang', async (req, res) => {
    try {
        // Update the user's language preference and redirect to the "/dashboard" URL
        const lang = req.params.lang;

        const userPreferences = await UserPreferences.findOne();
        if (userPreferences) {
            userPreferences.language = lang;
            await userPreferences.save();
        }

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating user language:', error);
        res.redirect('/dashboard');
    }
});

//Rendering account settings
app.get("/account-settings",  async (req, res) => {

    const allTimeZone = [{
        Name: 'Afghanistan',
        Code: 'AF',
        Timezone: 'Afghanistan Standard Time',
        UTC: 'UTC+04:30',
        MobileCode: '+93'
    }, {
        Name: 'Åland Islands',
        Code: 'AX',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+358-18'
    }, {
        Name: 'Albania',
        Code: 'AL',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+355'
    }, {
        Name: 'Algeria',
        Code: 'DZ',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+213'
    }, {
        Name: 'American Samoa',
        Code: 'AS',
        Timezone: 'UTC-11',
        UTC: 'UTC-11:00',
        MobileCode: '+1-684'
    }, {
        Name: 'Andorra',
        Code: 'AD',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+376'
    }, {
        Name: 'Angola',
        Code: 'AO',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+244'
    }, {
        Name: 'Anguilla',
        Code: 'AI',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-264'
    }, {
        Name: 'Antarctica',
        Code: 'AQ',
        Timezone: 'Pacific SA Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+'
    }, {
        Name: 'Antigua and Barbuda',
        Code: 'AG',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-268'
    }, {
        Name: 'Argentina',
        Code: 'AR',
        Timezone: 'Argentina Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+54'
    }, {
        Name: 'Armenia',
        Code: 'AM',
        Timezone: 'Caucasus Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+374'
    }, {
        Name: 'Aruba',
        Code: 'AW',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+297'
    }, {
        Name: 'Australia',
        Code: 'AU',
        Timezone: 'AUS Eastern Standard Time',
        UTC: 'UTC+10:00',
        MobileCode: '+61'
    }, {
        Name: 'Austria',
        Code: 'AT',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+43'
    }, {
        Name: 'Azerbaijan',
        Code: 'AZ',
        Timezone: 'Azerbaijan Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+994'
    }, {
        Name: 'Bahamas, The',
        Code: 'BS',
        Timezone: 'Eastern Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+1-242'
    }, {
        Name: 'Bahrain',
        Code: 'BH',
        Timezone: 'Arab Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+973'
    }, {
        Name: 'Bangladesh',
        Code: 'BD',
        Timezone: 'Bangladesh Standard Time',
        UTC: 'UTC+06:00',
        MobileCode: '+880'
    }, {
        Name: 'Barbados',
        Code: 'BB',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-246'
    }, {
        Name: 'Belarus',
        Code: 'BY',
        Timezone: 'Belarus Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+375'
    }, {
        Name: 'Belgium',
        Code: 'BE',
        Timezone: 'Romance Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+32'
    }, {
        Name: 'Belize',
        Code: 'BZ',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+501'
    }, {
        Name: 'Benin',
        Code: 'BJ',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+229'
    }, {
        Name: 'Bermuda',
        Code: 'BM',
        Timezone: 'Atlantic Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-441'
    }, {
        Name: 'Bhutan',
        Code: 'BT',
        Timezone: 'Bangladesh Standard Time',
        UTC: 'UTC+06:00',
        MobileCode: '+975'
    }, {
        Name: 'Bolivarian Republic of Venezuela',
        Code: 'VE',
        Timezone: 'Venezuela Standard Time',
        UTC: 'UTC-04:30',
        MobileCode: '+58'
    }, {
        Name: 'Bolivia',
        Code: 'BO',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+591'
    }, {
        Name: 'Bonaire, Sint Eustatius and Saba',
        Code: 'BQ',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+599'
    }, {
        Name: 'Bosnia and Herzegovina',
        Code: 'BA',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+387'
    }, {
        Name: 'Botswana',
        Code: 'BW',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+267'
    }, {Name: 'Bouvet Island', Code: 'BV', Timezone: 'UTC', UTC: 'UTC', MobileCode: '+'}, {
        Name: 'Brazil',
        Code: 'BR',
        Timezone: 'E. South America Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+55'
    }, {
        Name: 'British Indian Ocean Territory',
        Code: 'IO',
        Timezone: 'Central Asia Standard Time',
        UTC: 'UTC+06:00',
        MobileCode: '+246'
    }, {
        Name: 'Brunei',
        Code: 'BN',
        Timezone: 'Singapore Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+673'
    }, {
        Name: 'Bulgaria',
        Code: 'BG',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+359'
    }, {
        Name: 'Burkina Faso',
        Code: 'BF',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+226'
    }, {
        Name: 'Burundi',
        Code: 'BI',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+257'
    }, {
        Name: 'Cabo Verde',
        Code: 'CV',
        Timezone: 'Cape Verde Standard Time',
        UTC: 'UTC-01:00',
        MobileCode: '+238'
    }, {
        Name: 'Cambodia',
        Code: 'KH',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+855'
    }, {
        Name: 'Cameroon',
        Code: 'CM',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+237'
    }, {
        Name: 'Canada',
        Code: 'CA',
        Timezone: 'Eastern Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+1'
    }, {
        Name: 'Cayman Islands',
        Code: 'KY',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+1-345'
    }, {
        Name: 'Central African Republic',
        Code: 'CF',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+236'
    }, {
        Name: 'Chad',
        Code: 'TD',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+235'
    }, {
        Name: 'Chile',
        Code: 'CL',
        Timezone: 'Pacific SA Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+56'
    }, {
        Name: 'China',
        Code: 'CN',
        Timezone: 'China Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+86'
    }, {
        Name: 'Christmas Island',
        Code: 'CX',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+61'
    }, {
        Name: 'Cocos (Keeling) Islands',
        Code: 'CC',
        Timezone: 'Myanmar Standard Time',
        UTC: 'UTC+06:30',
        MobileCode: '+61'
    }, {
        Name: 'Colombia',
        Code: 'CO',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+57'
    }, {
        Name: 'Comoros',
        Code: 'KM',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+269'
    }, {
        Name: 'Congo',
        Code: 'CG',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+242'
    }, {
        Name: 'Congo (DRC)',
        Code: 'CD',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+243'
    }, {
        Name: 'Cook Islands',
        Code: 'CK',
        Timezone: 'Hawaiian Standard Time',
        UTC: 'UTC-10:00',
        MobileCode: '+682'
    }, {
        Name: 'Costa Rica',
        Code: 'CR',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+506'
    }, {
        Name: "Côte d'Ivoire",
        Code: 'CI',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+225'
    }, {
        Name: 'Croatia',
        Code: 'HR',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+385'
    }, {
        Name: 'Cuba',
        Code: 'CU',
        Timezone: 'Eastern Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+53'
    }, {
        Name: 'Curaçao',
        Code: 'CW',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+599'
    }, {
        Name: 'Cyprus',
        Code: 'CY',
        Timezone: 'E. Europe Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+357'
    }, {
        Name: 'Czech Republic',
        Code: 'CZ',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+420'
    }, {
        Name: 'Democratic Republic of Timor-Leste',
        Code: 'TL',
        Timezone: 'Tokyo Standard Time',
        UTC: 'UTC+09:00',
        MobileCode: '+670'
    }, {
        Name: 'Denmark',
        Code: 'DK',
        Timezone: 'Romance Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+45'
    }, {
        Name: 'Djibouti',
        Code: 'DJ',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+253'
    }, {
        Name: 'Dominica',
        Code: 'DM',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-767'
    }, {
        Name: 'Dominican Republic',
        Code: 'DO',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-809 and 1-829'
    }, {
        Name: 'Ecuador',
        Code: 'EC',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+593'
    }, {
        Name: 'Egypt',
        Code: 'EG',
        Timezone: 'Egypt Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+20'
    }, {
        Name: 'El Salvador',
        Code: 'SV',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+503'
    }, {
        Name: 'Equatorial Guinea',
        Code: 'GQ',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+240'
    }, {
        Name: 'Eritrea',
        Code: 'ER',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+291'
    }, {
        Name: 'Estonia',
        Code: 'EE',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+372'
    }, {
        Name: 'Ethiopia',
        Code: 'ET',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+251'
    }, {
        Name: 'Falkland Islands (Islas Malvinas)',
        Code: 'FK',
        Timezone: 'SA Eastern Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+500'
    }, {
        Name: 'Faroe Islands',
        Code: 'FO',
        Timezone: 'GMT Standard Time',
        UTC: 'UTC',
        MobileCode: '+298'
    }, {
        Name: 'Fiji Islands',
        Code: 'FJ',
        Timezone: 'Fiji Standard Time',
        UTC: 'UTC+12:00',
        MobileCode: '+679'
    }, {
        Name: 'Finland',
        Code: 'FI',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+358'
    }, {
        Name: 'France',
        Code: 'FR',
        Timezone: 'Romance Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+33'
    }, {
        Name: 'French Guiana',
        Code: 'GF',
        Timezone: 'SA Eastern Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+594'
    }, {
        Name: 'French Polynesia',
        Code: 'PF',
        Timezone: 'Hawaiian Standard Time',
        UTC: 'UTC-10:00',
        MobileCode: '+689'
    }, {
        Name: 'French Southern and Antarctic Lands',
        Code: 'TF',
        Timezone: 'West Asia Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+'
    }, {
        Name: 'Gabon',
        Code: 'GA',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+241'
    }, {
        Name: 'Gambia, The',
        Code: 'GM',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+220'
    }, {
        Name: 'Georgia',
        Code: 'GE',
        Timezone: 'Georgian Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+995'
    }, {
        Name: 'Germany',
        Code: 'DE',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+49'
    }, {
        Name: 'Ghana',
        Code: 'GH',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+233'
    }, {
        Name: 'Gibraltar',
        Code: 'GI',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+350'
    }, {
        Name: 'Greece',
        Code: 'GR',
        Timezone: 'GTB Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+30'
    }, {
        Name: 'Greenland',
        Code: 'GL',
        Timezone: 'Greenland Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+299'
    }, {
        Name: 'Grenada',
        Code: 'GD',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-473'
    }, {
        Name: 'Guadeloupe',
        Code: 'GP',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+590'
    }, {
        Name: 'Guam',
        Code: 'GU',
        Timezone: 'West Pacific Standard Time',
        UTC: 'UTC+10:00',
        MobileCode: '+1-671'
    }, {
        Name: 'Guatemala',
        Code: 'GT',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+502'
    }, {
        Name: 'Guernsey',
        Code: 'GG',
        Timezone: 'GMT Standard Time',
        UTC: 'UTC',
        MobileCode: '+44-1481'
    }, {
        Name: 'Guinea',
        Code: 'GN',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+224'
    }, {
        Name: 'Guinea-Bissau',
        Code: 'GW',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+245'
    }, {
        Name: 'Guyana',
        Code: 'GY',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+592'
    }, {
        Name: 'Haiti',
        Code: 'HT',
        Timezone: 'Eastern Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+509'
    }, {
        Name: 'Heard Island and McDonald Islands',
        Code: 'HM',
        Timezone: 'Mauritius Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+ '
    }, {
        Name: 'Honduras',
        Code: 'HN',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+504'
    }, {
        Name: 'Hong Kong SAR',
        Code: 'HK',
        Timezone: 'China Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+852'
    }, {
        Name: 'Hungary',
        Code: 'HU',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+36'
    }, {
        Name: 'Iceland',
        Code: 'IS',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+354'
    }, {
        Name: 'India',
        Code: 'IN',
        Timezone: 'India Standard Time',
        UTC: 'UTC+05:30',
        MobileCode: '+91'
    }, {
        Name: 'Indonesia',
        Code: 'ID',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+62'
    }, {Name: 'Iran', Code: 'IR', Timezone: 'Iran Standard Time', UTC: 'UTC+03:30', MobileCode: '+98'}, {
        Name: 'Iraq',
        Code: 'IQ',
        Timezone: 'Arabic Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+964'
    }, {Name: 'Ireland', Code: 'IE', Timezone: 'GMT Standard Time', UTC: 'UTC', MobileCode: '+353'}, {
        Name: 'Israel',
        Code: 'IL',
        Timezone: 'Israel Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+972'
    }, {
        Name: 'Italy',
        Code: 'IT',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+39'
    }, {
        Name: 'Jamaica',
        Code: 'JM',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+1-876'
    }, {
        Name: 'Jan Mayen',
        Code: 'SJ',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+47'
    }, {
        Name: 'Japan',
        Code: 'JP',
        Timezone: 'Tokyo Standard Time',
        UTC: 'UTC+09:00',
        MobileCode: '+81'
    }, {Name: 'Jersey', Code: 'JE', Timezone: 'GMT Standard Time', UTC: 'UTC', MobileCode: '+44-1534'}, {
        Name: 'Jordan',
        Code: 'JO',
        Timezone: 'Jordan Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+962'
    }, {
        Name: 'Kazakhstan',
        Code: 'KZ',
        Timezone: 'Central Asia Standard Time',
        UTC: 'UTC+06:00',
        MobileCode: '+7'
    }, {
        Name: 'Kenya',
        Code: 'KE',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+254'
    }, {Name: 'Kiribati', Code: 'KI', Timezone: 'UTC+12', UTC: 'UTC+12:00', MobileCode: '+686'}, {
        Name: 'Korea',
        Code: 'KR',
        Timezone: 'Korea Standard Time',
        UTC: 'UTC+09:00',
        MobileCode: '+82'
    }, {
        Name: 'Kosovo',
        Code: 'XK',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+'
    }, {
        Name: 'Kuwait',
        Code: 'KW',
        Timezone: 'Arab Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+965'
    }, {
        Name: 'Kyrgyzstan',
        Code: 'KG',
        Timezone: 'Central Asia Standard Time',
        UTC: 'UTC+06:00',
        MobileCode: '+996'
    }, {
        Name: 'Laos',
        Code: 'LA',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+856'
    }, {
        Name: 'Latvia',
        Code: 'LV',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+371'
    }, {
        Name: 'Lebanon',
        Code: 'LB',
        Timezone: 'Middle East Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+961'
    }, {
        Name: 'Lesotho',
        Code: 'LS',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+266'
    }, {
        Name: 'Liberia',
        Code: 'LR',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+231'
    }, {
        Name: 'Libya',
        Code: 'LY',
        Timezone: 'E. Europe Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+218'
    }, {
        Name: 'Liechtenstein',
        Code: 'LI',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+423'
    }, {
        Name: 'Lithuania',
        Code: 'LT',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+370'
    }, {
        Name: 'Luxembourg',
        Code: 'LU',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+352'
    }, {
        Name: 'Macao SAR',
        Code: 'MO',
        Timezone: 'China Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+853'
    }, {
        Name: 'Macedonia, Former Yugoslav Republic of',
        Code: 'MK',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+389'
    }, {
        Name: 'Madagascar',
        Code: 'MG',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+261'
    }, {
        Name: 'Malawi',
        Code: 'MW',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+265'
    }, {
        Name: 'Malaysia',
        Code: 'MY',
        Timezone: 'Singapore Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+60'
    }, {
        Name: 'Maldives',
        Code: 'MV',
        Timezone: 'West Asia Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+960'
    }, {Name: 'Mali', Code: 'ML', Timezone: 'Greenwich Standard Time', UTC: 'UTC', MobileCode: '+223'}, {
        Name: 'Malta',
        Code: 'MT',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+356'
    }, {
        Name: 'Man, Isle of',
        Code: 'IM',
        Timezone: 'GMT Standard Time',
        UTC: 'UTC',
        MobileCode: '+44-1624'
    }, {
        Name: 'Marshall Islands',
        Code: 'MH',
        Timezone: 'UTC+12',
        UTC: 'UTC+12:00',
        MobileCode: '+692'
    }, {
        Name: 'Martinique',
        Code: 'MQ',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+596'
    }, {
        Name: 'Mauritania',
        Code: 'MR',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+222'
    }, {
        Name: 'Mauritius',
        Code: 'MU',
        Timezone: 'Mauritius Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+230'
    }, {
        Name: 'Mayotte',
        Code: 'YT',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+262'
    }, {
        Name: 'Mexico',
        Code: 'MX',
        Timezone: 'Central Standard Time (Mexico)',
        UTC: 'UTC-06:00',
        MobileCode: '+52'
    }, {
        Name: 'Micronesia',
        Code: 'FM',
        Timezone: 'West Pacific Standard Time',
        UTC: 'UTC+10:00',
        MobileCode: '+691'
    }, {
        Name: 'Moldova',
        Code: 'MD',
        Timezone: 'GTB Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+373'
    }, {
        Name: 'Monaco',
        Code: 'MC',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+377'
    }, {
        Name: 'Mongolia',
        Code: 'MN',
        Timezone: 'Ulaanbaatar Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+976'
    }, {
        Name: 'Montenegro',
        Code: 'ME',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+382'
    }, {
        Name: 'Montserrat',
        Code: 'MS',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-664'
    }, {
        Name: 'Morocco',
        Code: 'MA',
        Timezone: 'Morocco Standard Time',
        UTC: 'UTC',
        MobileCode: '+212'
    }, {
        Name: 'Mozambique',
        Code: 'MZ',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+258'
    }, {
        Name: 'Myanmar',
        Code: 'MM',
        Timezone: 'Myanmar Standard Time',
        UTC: 'UTC+06:30',
        MobileCode: '+95'
    }, {
        Name: 'Namibia',
        Code: 'NA',
        Timezone: 'Namibia Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+264'
    }, {Name: 'Nauru', Code: 'NR', Timezone: 'UTC+12', UTC: 'UTC+12:00', MobileCode: '+674'}, {
        Name: 'Nepal',
        Code: 'NP',
        Timezone: 'Nepal Standard Time',
        UTC: 'UTC+05:45',
        MobileCode: '+977'
    }, {
        Name: 'Netherlands',
        Code: 'NL',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+31'
    }, {
        Name: 'New Caledonia',
        Code: 'NC',
        Timezone: 'Central Pacific Standard Time',
        UTC: 'UTC+11:00',
        MobileCode: '+687'
    }, {
        Name: 'New Zealand',
        Code: 'NZ',
        Timezone: 'New Zealand Standard Time',
        UTC: 'UTC+12:00',
        MobileCode: '+64'
    }, {
        Name: 'Nicaragua',
        Code: 'NI',
        Timezone: 'Central America Standard Time',
        UTC: 'UTC-06:00',
        MobileCode: '+505'
    }, {
        Name: 'Niger',
        Code: 'NE',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+227'
    }, {
        Name: 'Nigeria',
        Code: 'NG',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+234'
    }, {Name: 'Niue', Code: 'NU', Timezone: 'UTC-11', UTC: 'UTC-11:00', MobileCode: '+683'}, {
        Name: 'Norfolk Island',
        Code: 'NF',
        Timezone: 'Central Pacific Standard Time',
        UTC: 'UTC+11:00',
        MobileCode: '+672'
    }, {
        Name: 'North Korea',
        Code: 'KP',
        Timezone: 'Korea Standard Time',
        UTC: 'UTC+09:00',
        MobileCode: '+850'
    }, {
        Name: 'Northern Mariana Islands',
        Code: 'MP',
        Timezone: 'West Pacific Standard Time',
        UTC: 'UTC+10:00',
        MobileCode: '+1-670'
    }, {
        Name: 'Norway',
        Code: 'NO',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+47'
    }, {
        Name: 'Oman',
        Code: 'OM',
        Timezone: 'Arabian Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+968'
    }, {
        Name: 'Pakistan',
        Code: 'PK',
        Timezone: 'Pakistan Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+92'
    }, {
        Name: 'Palau',
        Code: 'PW',
        Timezone: 'Tokyo Standard Time',
        UTC: 'UTC+09:00',
        MobileCode: '+680'
    }, {
        Name: 'Palestinian Authority',
        Code: 'PS',
        Timezone: 'Egypt Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+970'
    }, {
        Name: 'Panama',
        Code: 'PA',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+507'
    }, {
        Name: 'Papua New Guinea',
        Code: 'PG',
        Timezone: 'West Pacific Standard Time',
        UTC: 'UTC+10:00',
        MobileCode: '+675'
    }, {
        Name: 'Paraguay',
        Code: 'PY',
        Timezone: 'Paraguay Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+595'
    }, {
        Name: 'Peru',
        Code: 'PE',
        Timezone: 'SA Pacific Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+51'
    }, {
        Name: 'Philippines',
        Code: 'PH',
        Timezone: 'Singapore Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+63'
    }, {
        Name: 'Pitcairn Islands',
        Code: 'PN',
        Timezone: 'Pacific Standard Time',
        UTC: 'UTC-08:00',
        MobileCode: '+870'
    }, {
        Name: 'Poland',
        Code: 'PL',
        Timezone: 'Central European Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+48'
    }, {
        Name: 'Portugal',
        Code: 'PT',
        Timezone: 'GMT Standard Time',
        UTC: 'UTC',
        MobileCode: '+351'
    }, {
        Name: 'Puerto Rico',
        Code: 'PR',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-787 and 1-939'
    }, {
        Name: 'Qatar',
        Code: 'QA',
        Timezone: 'Arab Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+974'
    }, {
        Name: 'Reunion',
        Code: 'RE',
        Timezone: 'Mauritius Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+262'
    }, {
        Name: 'Romania',
        Code: 'RO',
        Timezone: 'GTB Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+40'
    }, {
        Name: 'Russia',
        Code: 'RU',
        Timezone: 'Russian Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+7'
    }, {
        Name: 'Rwanda',
        Code: 'RW',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+250'
    }, {
        Name: 'Saint Barthélemy',
        Code: 'BL',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+590'
    }, {
        Name: 'Saint Helena, Ascension and Tristan da Cunha',
        Code: 'SH',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+290'
    }, {
        Name: 'Saint Kitts and Nevis',
        Code: 'KN',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-869'
    }, {
        Name: 'Saint Lucia',
        Code: 'LC',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-758'
    }, {
        Name: 'Saint Martin (French part)',
        Code: 'MF',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+590'
    }, {
        Name: 'Saint Pierre and Miquelon',
        Code: 'PM',
        Timezone: 'Greenland Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+508'
    }, {
        Name: 'Saint Vincent and the Grenadines',
        Code: 'VC',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-784'
    }, {
        Name: 'Samoa',
        Code: 'WS',
        Timezone: 'Samoa Standard Time',
        UTC: 'UTC+13:00',
        MobileCode: '+685'
    }, {
        Name: 'San Marino',
        Code: 'SM',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+378'
    }, {
        Name: 'São Tomé and Príncipe',
        Code: 'ST',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+239'
    }, {
        Name: 'Saudi Arabia',
        Code: 'SA',
        Timezone: 'Arab Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+966'
    }, {
        Name: 'Senegal',
        Code: 'SN',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+221'
    }, {
        Name: 'Serbia',
        Code: 'RS',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+381'
    }, {
        Name: 'Seychelles',
        Code: 'SC',
        Timezone: 'Mauritius Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+248'
    }, {
        Name: 'Sierra Leone',
        Code: 'SL',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+232'
    }, {
        Name: 'Singapore',
        Code: 'SG',
        Timezone: 'Singapore Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+65'
    }, {
        Name: 'Sint Maarten (Dutch part)',
        Code: 'SX',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+599'
    }, {
        Name: 'Slovakia',
        Code: 'SK',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+421'
    }, {
        Name: 'Slovenia',
        Code: 'SI',
        Timezone: 'Central Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+386'
    }, {
        Name: 'Solomon Islands',
        Code: 'SB',
        Timezone: 'Central Pacific Standard Time',
        UTC: 'UTC+11:00',
        MobileCode: '+677'
    }, {
        Name: 'Somalia',
        Code: 'SO',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+252'
    }, {
        Name: 'South Africa',
        Code: 'ZA',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+27'
    }, {
        Name: 'South Georgia and the South Sandwich Islands',
        Code: 'GS',
        Timezone: 'UTC-02',
        UTC: 'UTC-02:00',
        MobileCode: '+'
    }, {
        Name: 'South Sudan',
        Code: 'SS',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+211'
    }, {
        Name: 'Spain',
        Code: 'ES',
        Timezone: 'Romance Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+34'
    }, {
        Name: 'Sri Lanka',
        Code: 'LK',
        Timezone: 'Sri Lanka Standard Time',
        UTC: 'UTC+05:30',
        MobileCode: '+94'
    }, {
        Name: 'Sudan',
        Code: 'SD',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+249'
    }, {
        Name: 'Suriname',
        Code: 'SR',
        Timezone: 'SA Eastern Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+597'
    }, {
        Name: 'Svalbard',
        Code: 'SJ',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+47'
    }, {
        Name: 'Swaziland',
        Code: 'SZ',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+268'
    }, {
        Name: 'Sweden',
        Code: 'SE',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+46'
    }, {
        Name: 'Switzerland',
        Code: 'CH',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+41'
    }, {
        Name: 'Syria',
        Code: 'SY',
        Timezone: 'Syria Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+963'
    }, {
        Name: 'Taiwan',
        Code: 'TW',
        Timezone: 'Taipei Standard Time',
        UTC: 'UTC+08:00',
        MobileCode: '+886'
    }, {
        Name: 'Tajikistan',
        Code: 'TJ',
        Timezone: 'West Asia Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+992'
    }, {
        Name: 'Tanzania',
        Code: 'TZ',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+255'
    }, {
        Name: 'Thailand',
        Code: 'TH',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+66'
    }, {
        Name: 'Togo',
        Code: 'TG',
        Timezone: 'Greenwich Standard Time',
        UTC: 'UTC',
        MobileCode: '+228'
    }, {
        Name: 'Tokelau',
        Code: 'TK',
        Timezone: 'Tonga Standard Time',
        UTC: 'UTC+13:00',
        MobileCode: '+690'
    }, {
        Name: 'Tonga',
        Code: 'TO',
        Timezone: 'Tonga Standard Time',
        UTC: 'UTC+13:00',
        MobileCode: '+676'
    }, {
        Name: 'Trinidad and Tobago',
        Code: 'TT',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-868'
    }, {
        Name: 'Tunisia',
        Code: 'TN',
        Timezone: 'W. Central Africa Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+216'
    }, {
        Name: 'Turkey',
        Code: 'TR',
        Timezone: 'Turkey Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+90'
    }, {
        Name: 'Turkmenistan',
        Code: 'TM',
        Timezone: 'West Asia Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+993'
    }, {
        Name: 'Turks and Caicos Islands',
        Code: 'TC',
        Timezone: 'Eastern Standard Time',
        UTC: 'UTC-05:00',
        MobileCode: '+1-649'
    }, {
        Name: 'Tuvalu',
        Code: 'TV',
        Timezone: 'UTC+12',
        UTC: 'UTC+12:00',
        MobileCode: '+688'
    }, {
        Name: 'U.S. Minor Outlying Islands',
        Code: 'UM',
        Timezone: 'UTC-11',
        UTC: 'UTC-11:00',
        MobileCode: '+1'
    }, {
        Name: 'Uganda',
        Code: 'UG',
        Timezone: 'E. Africa Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+256'
    }, {
        Name: 'Ukraine',
        Code: 'UA',
        Timezone: 'FLE Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+380'
    }, {
        Name: 'United Arab Emirates',
        Code: 'AE',
        Timezone: 'Arabian Standard Time',
        UTC: 'UTC+04:00',
        MobileCode: '+971'
    }, {
        Name: 'United Kingdom',
        Code: 'GB',
        Timezone: 'GMT Standard Time',
        UTC: 'UTC',
        MobileCode: '+44'
    }, {
        Name: 'United States',
        Code: 'US',
        Timezone: 'Pacific Standard Time',
        UTC: 'UTC-08:00',
        MobileCode: '+1'
    }, {
        Name: 'Uruguay',
        Code: 'UY',
        Timezone: 'Montevideo Standard Time',
        UTC: 'UTC-03:00',
        MobileCode: '+598'
    }, {
        Name: 'Uzbekistan',
        Code: 'UZ',
        Timezone: 'West Asia Standard Time',
        UTC: 'UTC+05:00',
        MobileCode: '+998'
    }, {
        Name: 'Vanuatu',
        Code: 'VU',
        Timezone: 'Central Pacific Standard Time',
        UTC: 'UTC+11:00',
        MobileCode: '+678'
    }, {
        Name: 'Vatican City',
        Code: 'VA',
        Timezone: 'W. Europe Standard Time',
        UTC: 'UTC+01:00',
        MobileCode: '+379'
    }, {
        Name: 'Vietnam',
        Code: 'VN',
        Timezone: 'SE Asia Standard Time',
        UTC: 'UTC+07:00',
        MobileCode: '+84'
    }, {
        Name: 'Virgin Islands, U.S.',
        Code: 'VI',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-340'
    }, {
        Name: 'Virgin Islands, British',
        Code: 'VG',
        Timezone: 'SA Western Standard Time',
        UTC: 'UTC-04:00',
        MobileCode: '+1-284'
    }, {
        Name: 'Wallis and Futuna',
        Code: 'WF',
        Timezone: 'UTC+12',
        UTC: 'UTC+12:00',
        MobileCode: '+681'
    }, {
        Name: 'Yemen',
        Code: 'YE',
        Timezone: 'Arab Standard Time',
        UTC: 'UTC+03:00',
        MobileCode: '+967'
    }, {
        Name: 'Zambia',
        Code: 'ZM',
        Timezone: 'South Africa Standard Time',
        UTC: 'UTC+02:00',
        MobileCode: '+260'
    }, {Name: 'Zimbabwe', Code: 'ZW', Timezone: 'South Africa Standard Time', UTC: 'UTC+02:00', MobileCode: '+263'}]
    let lastUploadedDoctorPhoto;

    try {
        // Retrieve the last uploaded doctor photo
        const doctorPhotodocs = await DoctorPhoto.find({}).sort({_id: -1}).limit(1).exec();

        if (doctorPhotodocs.length > 0) {
            // Assign the last uploaded photo to the variable
            lastUploadedDoctorPhoto = path.basename(doctorPhotodocs[0].doctorPhoto);

            // Use the last uploaded photo here
            console.log(lastUploadedDoctorPhoto);
        }

        // Retrieve other necessary data from the database
        const doctor = await Doctor.find({}).exec();
        // const authentication = await Authentication.find({}).exec();
        const clinic = await Clinic.find({}).exec();
        const settingSocialMedia = await SettingSocialMedia.find({}).exec();

        // Render the accountSetting view with the retrieved data
        res.render('accountSetting', {
            lastUploadedDoctorPhoto: encodeURIComponent(lastUploadedDoctorPhoto),
            doctor: doctor.length > 0 ? doctor[0] : null,
            // authentication: authentication.length > 0 ? authentication[0] : null,
            clinic: clinic.length > 0 ? clinic[0] : null,
            settingSocialMedia: settingSocialMedia.length > 0 ? settingSocialMedia[0] : null,
            allTimeZone: allTimeZone
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }

})

//This code block sets up a route handler for the "/invoices" URL path. It retrieves the latest 10 invoices from the database and finds patients who have invoices associated with them. The invoices are populated for each patient. Finally, it renders the "invoices" view, passing the found patients and invoices to the view.
app.get("/invoices", async (req, res) => {
    try {
        // Retrieve the latest 10 invoices from the database
        const foundInvoices = await Invoice.find({}).limit(10).exec();

        // Find patients with invoices and populate their invoices
        const foundPatients = await Patient.find({ invoices: { $exists: true, $ne: [] } })
            .populate("invoices")
            .exec();

        // Render the 'invoices' view with the found patients and invoices
        res.render('invoices', { foundPatients, foundInvoices });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/doctor-profile" URL path. It renders the "doctorProfile" view.
app.get("/doctor-profile", (req, res) => {
    // Render the 'doctorProfile' view
    res.render('doctorProfile');
});

//This code block sets up a route handler for the "/book-appointment" URL path. It defines an array of hours and then retrieves appointments, approved appointments, and canceled appointments from the database. It renders the "book-appointment" view, passing the retrieved data and hours list to the view.
app.get("/book-appointment", async (req, res) => {
    const hoursList = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    try {
        // Retrieve appointments, approved appointments, and canceled appointments from the database
        const foundAppointments = await Appointment.find({}).exec();
        const foundApprovedAppointments = await ApprovedAppointment.find({}).exec();
        const foundCanceledAppointments = await DeletedAppointment.find({}).exec();

        // Render the "book-appointment" view with the retrieved data
        res.render("book-appointment", {
            foundAppointments,
            foundApprovedAppointments,
            foundCanceledAppointments,
            hoursList
        });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//This code block sets up a route handler for the "/approved-appointments" URL path. It retrieves approved appointments from the database and renders the "approved-appointment" view, passing the found approved appointments to the view.
app.get("/approved-appointments", async (req, res) => {
    try {
        // Retrieve approved appointments from the database
        const foundApprovedAppointments = await ApprovedAppointment.find({}).exec();

        // Render the "approved-appointment" view with the found approved appointments
        res.render("approved-appointment", {
            foundApprovedAppointments,
        });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//This code block sets up a route handler for the "/canceled-appointments" URL path. It retrieves canceled appointments from the database and renders the "canceled-appointments" view, passing the found canceled appointments to the view.
app.get("/canceled-appointments", async (req, res) => {
    try {
        // Retrieve canceled appointments from the database
        const foundCanceledAppointments = await DeletedAppointment.find({}).exec();

        // Render the "canceled-appointments" view with the found canceled appointments
        res.render("canceled-appointments", {
            foundCanceledAppointments,
        });
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

//This code defines a function generateStars() that generates star icons based on a given rating. It takes the rating as input and returns a string containing HTML-encoded star icons (filled or empty) representing the rating.
// Star icons generator
function generateStars(rating) {
    var stars = "";
    for (var i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += "&#9733; "; // Filled star
        } else {
            stars += "&#9734; "; // Empty star
        }
    }
    return stars;
}

//This code block sets up a route handler for the "/patients" URL path. It retrieves all patients from the database and renders the "patients" view, passing the found patients to the view.
app.get("/patients", async (req, res) => {
    try {
        // Retrieve all patients from the database
        const foundPatients = await Patient.find({}).exec();

        // Render the "patients" view with the found patients
        res.render("patients", {
            foundPatients,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/patient-profile" URL path. It retrieves a patient's ID from the query parameters and finds the patient by ID, populating their invoices. If the patient is not found, it sends a 404 response. It also retrieves last visits, appointments, approved appointments, deleted appointments, and the last invoice for the patient. Finally, it renders the "patient-profile" view, passing the retrieved data and hours list to the view.
app.get("/patient-profile", async (req, res) => {
    const patientId = req.query.id;
    const hoursList = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    try {
        // Find the patient by ID and populate their invoices
        const patient = await Patient.findById(patientId).populate("invoices");

        // If patient is not found, send a 404 response
        if (!patient) {
            return res.status(404).send("Patient not found");
        }

        // Retrieve  appointments, approved appointments, deleted appointments, and the last invoice
        const foundAppointments = await Appointment.find({}).exec();
        const Appointments = await Appointment.find({ idNumber: patient.idNumber }).exec();
        const approvedAppointments = await ApprovedAppointment.find({ idNumber: patient.idNumber }).exec();
        const deletedAppointments = await DeletedAppointment.find({ idNumber: patient.idNumber }).exec();
        const lastInvoice = patient.invoices.length > 0 ? patient.invoices[patient.invoices.length - 1] : null;

        // Render the "patient-profile" view with the retrieved data
        res.render("patient-profile", {
            patient,
            lastInvoice,
            hoursList,
            foundAppointments,
            Appointments,
            approvedAppointments,
            deletedAppointments
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/reviews" URL path. It retrieves reviews that are not viewed from the database. Then, it updates the viewed status of those reviews to true and counts the number of new reviews that are not viewed. An event is emitted to update the new reviews count. The code then retrieves active and inactive reviews from the database. It maps the active and inactive reviews to include stars based on the rating using the generateStars() function. Finally, it renders the "reviews" view, passing the active and inactive reviews with stars to the view.
app.get("/reviews", async (req, res) => {
    try {
        // Retrieve reviews that are not viewed
        const reviews = await Review.find({ viewed: false });

        // Update the viewed status of the retrieved reviews to true
        await Review.updateMany({ viewed: false }, { viewed: true });

        // Count the number of new reviews that are not viewed
        const newReviewsCount = await Review.countDocuments({ viewed: false });

        // Emit an event to update the new reviews count
        eventEmitter.emit('update', newReviewsCount);

        // Retrieve active and inactive reviews
        const activeReviews = await Review.find({ active: true }).exec();
        const inactiveReviews = await Review.find({ active: false }).exec();

        // Map the active reviews and inactive reviews to include stars based on the rating
        const activeReviewsWithStars = activeReviews.map((review) => ({
            ...review.toObject(),
            stars: generateStars(review.rating),
        }));

        const inactiveReviewsWithStars = inactiveReviews.map((review) => ({
            ...review.toObject(),
            stars: generateStars(review.rating),
        }));

        // Render the "reviews" view with the active and inactive reviews
        res.render("reviews", {
            activeReviews: activeReviewsWithStars,
            inactiveReviews: inactiveReviewsWithStars,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/contact-requests" URL path. It updates the viewed status of contact requests to true and counts the number of new contact requests that are not viewed. An event is emitted to update the new contact requests count. The code then retrieves persons to contact and contacted persons from the database. Finally, it renders the "contact" view, passing the persons to contact and contacted persons to the view.
app.get("/contact-requests", async (req, res) => {
    try {
        // Update the viewed status of contact requests to true
        await Contact.updateMany({ viewed: false }, { viewed: true });

        // Count the number of new contact requests that are not viewed
        const newContactsCount = await Contact.countDocuments({ viewed: false });

        // Emit an event to update the new contact requests count
        contactEventEmitter.emit('update', newContactsCount);

        // Retrieve persons to contact and contacted persons
        const personsToContact = await Contact.find({ contacted: false }).exec();
        const contactedPersons = await Contact.find({ contacted: true }).exec();

        // Render the "contact" view with persons to contact and contacted persons
        res.render("contact", { personsToContact, contactedPersons });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

//This code block sets up a route handler for the "/contacts/count" URL path. It counts the number of new contact requests that are not viewed and sends the count as a JSON response.
app.get('/contacts/count', async (req, res) => {
    try {
        // Count the number of new contact requests that are not viewed
        const newContactsCount = await Contact.countDocuments({ viewed: false });

        // Send the count as a JSON response
        res.json({ count: newContactsCount });
    } catch (error) {
        console.error('Error fetching contact count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//This code block sets up a route handler for the "/api/patients/:id" URL path. It retrieves the patient's ID from the request parameters and finds the patient by ID. If the patient is not found, it sends a 404 response with an error message. Otherwise, it sends the patient as a JSON response.
app.get('/api/patients/:id', async (req, res) => {
    const patientId = req.params.id;

    try {
        // Find a patient by ID
        const patient = await Patient.findById(patientId);

        // If the patient is not found, send a 404 response with an error message
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Send the patient as a JSON response
        res.json(patient);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//This code block sets up a route handler for the "/reviews/count" URL path. It counts the number of new reviews that are not viewed and sends the count as a JSON response.
app.get('/reviews/count', async (req, res) => {
    try {
        // Count the number of new reviews that are not viewed
        const newReviewsCount = await Review.countDocuments({ viewed: false });

        // Send the count as a JSON response
        res.json({ count: newReviewsCount });
    } catch (error) {
        console.error('Error fetching review count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Post requests ..............
//This route is responsible for booking an appointment. It retrieves the necessary appointment details from the request body and updates an existing appointment or creates a new one. The updated or newly created appointment is then saved to the database.

//This code block retrieves the necessary data from the request body, including idNumber, firstName, lastName, dateOfBirth, gender, service, date, time, email, tel, and paragraph.
//
// Inside a try-catch block, it uses await to asynchronously find an existing appointment based on the idNumber. If an appointment with the provided idNumber exists, it updates the appointment with the new data using findOneAndUpdate.
//
// If the appointment does not exist (based on upsert: true), it creates a new appointment using the provided data.
//
// The new: true option ensures that the updated or newly created appointment is returned as the result.
//
// The code logs the saved appointment to the console for debugging purposes.
//
// Finally, it redirects the user to the /book-appointment page.
//
// In case of any errors during the process, it logs the error to the console and sends a 500 Internal Server Error response.
app.post("/book-appointment", async (req, res) => {
    const idNumber = req.body.idNumber;
    const firstName = req.body.fName;
    const lastName = req.body.lName;
    const dateOfBirth = req.body.dateOfBirth;
    const gender = req.body.gender;
    const service = req.body.service;
    const date = req.body.date;
    const time = req.body.time;
    const email = req.body.email;
    const tel = req.body.tel;
    const paragraph = req.body.paragraph;

    try {
        const appointment = await Appointment.findOneAndUpdate(
            { idNumber: idNumber },
            {
                $set: {
                    fName: firstName,
                    lName: lastName,
                    dateOfBirth: dateOfBirth,
                    gender: gender,
                    service: service,
                    date: date,
                    time: time,
                    email: email,
                    tel: tel,
                    paragraph: paragraph,
                },
            },
            { upsert: true, new: true }
        );

        console.log('Appointment saved:', appointment);
        res.redirect("/book-appointment");
    } catch (error) {
        console.error('Error saving appointment:', error);
        res.status(500).send('Internal server error');
    }
});

//This code block sets up a route handler for the "/online-appointment-booking" URL path with a POST method. It expects a request body with a formData object. The code retrieves the necessary data from the formData object and assigns them to variables. It then tries to find and update an existing appointment using the idNumber, or creates a new appointment if not found. The appointment data is updated or set based on the received form data. The { upsert: true, new: true } options ensure that a new appointment is created if it doesn't exist and the updated appointment is returned. The code logs the saved appointment and sends a JSON response indicating success.
app.post('/online-appointment-booking', async (req, res) => {
    const formData = req.body.formData;
    console.log(formData);

    const idNumber = formData.idNumber;
    const firstName = formData.fName;
    const lastName = formData.lName;
    const gender = formData.gender;
    const date = formData.date;
    const time = formData.time;
    const email = formData.email;
    const tel = formData.tel;
    const paragraph = formData.paragraph;

    try {
        // Find and update an existing appointment or create a new one if not found
        let appointment = await Appointment.findOneAndUpdate(
            { idNumber: idNumber },
            {
                $set: {
                    fName: firstName,
                    lName: lastName,
                    gender: gender,
                    date: date,
                    time: time,
                    email: email,
                    tel: tel,
                    paragraph: paragraph,
                },
            },
            { upsert: true, new: true }
        );

        console.log('Appointment saved:', appointment);

        // Send a JSON response indicating success
        res.status(200).json({ message: 'Appointment saved successfully' });
    } catch (error) {
        console.error('Error saving appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//the route handler is using app.post() to handle HTTP POST requests to "/patient-profile". It extracts various data fields from the request body using req.body. The extracted fields are then used to update a Patient document in a database using Patient.findOneAndUpdate().
app.post("/patient-profile", (req, res) => {
    const patientId = req.body.patientId;
    const idNumber = req.body.idNumber;
    const fName = req.body.fName;
    const lName = req.body.lName;
    const tel = req.body.tel;
    const age = req.body.age;
    const gender = req.body.gender;
    const email = req.body.email;
    const dateOfBirth = req.body.dateOfBirth;
    const address = req.body.adress;

    Patient.findOneAndUpdate(
        { _id: patientId },
        {
            idNumber: idNumber,
            fName: fName,
            lName: lName,
            tel: tel,
            age: age,
            gender: gender,
            email: email,
            dateOfBirth: dateOfBirth,
            address: address,
        },
        { new: true }
    )
        .then((doc) => {
            res.redirect('/patients');
        })
        .catch((err) => {
            throw err;
        });
});

app.delete("/delete-appointment/:appointmentID", async (req, res) => {
    try {
        // Extract the appointment ID from the request parameters
        const appointmentId = req.params.appointmentID;

        // Find and delete the appointment from the database
        const deletedAppointment = await Appointment.findOneAndDelete({ _id: appointmentId }).exec();

        if (!deletedAppointment) {
            // Send an error response if the appointment was not found
            res.json({ success: false, message: 'Error deleting appointment. Appointment not found.' });
        } else {
            // Create a new deleted appointment record with the details from the found appointment
            const canceledAppointment = new DeletedAppointment({
                idNumber: deletedAppointment.idNumber,
                fName: deletedAppointment.fName,
                lName: deletedAppointment.lName,
                tel: deletedAppointment.tel,
                service: deletedAppointment.service,
                date: deletedAppointment.date,
                time: deletedAppointment.time,
            });

            // Save the canceled appointment record
            await canceledAppointment.save();

            console.log("Appointment moved successfully.");
            // Send a success response
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles the deletion of an invoice. It expects the invoice ID to be specified in the URL parameter invoiceID. The code tries to find and delete the invoice with the specified ID using findOneAndDelete method of the Invoice model. If the invoice is not found, it sends an error response. Otherwise, it sends a success response.
app.delete("/delete-invoice/:invoiceID", async (req, res) => {
    try {
        // Extract the invoice ID from the request parameters
        const invoiceId = req.params.invoiceID;

        // Find and delete the invoice from the database
        const deletedInvoice = await Invoice.findOneAndDelete({ _id: invoiceId }).exec();

        if (!deletedInvoice) {
            // Send an error response if the invoice was not found
            res.json({ success: false, message: 'Error deleting invoice. Invoice not found.' });
        } else {
            console.log("Invoice removed successfully.");
            // Send a success response
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles the deletion of a review. It expects the review ID to be specified in the URL parameter reviewID.
// The code tries to find and delete the review with the specified ID using findOneAndDelete method of the Review model.
// If the review is not found, it sends an error response. Otherwise, it sends a success response.
app.delete("/delete-review/:reviewID", async (req, res) => {
    try {
        // Extract the review ID from the request parameters
        const reviewId = req.params.reviewID;

        // Find and delete the review from the database
        const deletedReview = await Review.findOneAndDelete({ _id: reviewId }).exec();

        if (!deletedReview) {
            // Send an error response if the review was not found
            res.json({ success: false, message: 'Error deleting review. Review not found.' });
        } else {
            console.log("Review removed successfully.");
            // Send a success response
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles the deletion of a contact. It expects the contact ID to be specified in the URL parameter contactID.
// The code tries to find and delete the contact with the specified ID using findOneAndDelete method of the Contact model.
// If the contact is not found, it sends an error response. Otherwise, it sends a success response.
app.delete("/delete-contact/:contactID", async (req, res) => {
    try {
        // Extract the contact ID from the request parameters
        const contactId = req.params.contactID;

        // Find and delete the contact from the database
        const deletedContact = await Contact.findOneAndDelete({ _id: contactId }).exec();

        if (!deletedContact) {
            // Send an error response if the contact was not found
            res.json({ success: false, message: 'Error deleting contact. Contact not found.' });
        } else {
            console.log("Contact removed successfully.");
            // Send a success response
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles the deletion of a patient. It expects the patient ID to be specified in the URL parameter patientID.
// The code tries to find and delete the patient with the specified ID using findOneAndDelete method of the Patient model.
// If the patient is not found, it sends an error response. Otherwise, it sends a success response.
app.delete("/delete-patient/:patientID", async (req, res) => {
    try {
        // Extract the patient ID from the request parameters
        const patientID = req.params.patientID;

        // Find and delete the patient from the database
        const deletedPatient = await Patient.findOneAndDelete({ _id: patientID }).exec();

        if (!deletedPatient) {
            // Send an error response if the patient was not found
            res.json({ success: false, message: 'Error deleting patient. Patient not found.' });
        } else {
            console.log("Patient removed successfully.");
            // Send a success response
            res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles toggling the "active" status of a review. It expects the review ID to be specified in the URL parameter reviewID.
// The code tries to find the review with the specified ID using findOne method of the Review model.
// If the review is not found, it sends an error response. Otherwise, it toggles the active property of the review and saves the updated review.
// It sends a success response if the operation is successful, or an error response if there is an issue.
app.post("/active-review/:reviewID", async (req, res) => {
    try {
        // Extract the review ID from the request parameters
        const reviewId = req.params.reviewID;

        // Find the review in the database
        const foundReview = await Review.findOne({ _id: reviewId }).exec();

        if (!foundReview) {
            // Send an error response if the review is not found
            return res.json({ success: false, message: "Review not found." });
        }

        // Toggle the "active" property of the review
        foundReview.active = !foundReview.active;

        // Save the updated review
        await foundReview.save();

        console.log("Review activation status updated successfully.");
        // Send a success response
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        // Send an error response if there was an issue toggling the review activation
        res.json({ success: false, message: "Error toggling review activation." });
    }
});

//This route handles toggling the "contacted" status of a person. It expects the person ID to be specified in the URL parameter personID.
// The code tries to find the person with the specified ID using findOne method of the Contact model.
// If the person is not found, it sends an error response. Otherwise, it toggles the contacted property of the person and saves the updated person.
// It sends a success response if the operation is successful, or an error response if there is an issue.
app.post("/contact-person/:personID", async (req, res) => {
    try {
        // Extract the person ID from the request parameters
        const personId = req.params.personID;

        // Find the person in the database
        const foundPerson = await Contact.findOne({ _id: personId }).exec();

        if (!foundPerson) {
            // Send an error response if the person is not found
            return res.json({ success: false, message: "Person not found." });
        }

        // Toggle the "contacted" property of the person
        foundPerson.contacted = !foundPerson.contacted;

        // Save the updated person
        await foundPerson.save();

        console.log("Person connection status updated successfully.");
        // Send a success response
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        // Send an error response if there was an issue toggling the person connection
        res.json({ success: false, message: "Error toggling person connection." });
    }
});

//This route handles the deletion of a past appointment. It expects the appointment ID to be specified in the URL parameter appointmentID.
// The code uses Promise.all() to wait for both ApprovedAppointment.findOneAndDelete() and DeletedAppointment.findOneAndDelete() operations to complete.
// After successful deletion, it logs the deleted approved and deleted appointments.
// It sends a success response to the client if the deletion is successful, or an error response if there was an issue.
app.delete("/del-past-appointment/:appointmentID", async (req, res) => {
    const appointmentId = req.params.appointmentID;
    console.log(appointmentId)

    // use Promise.all() to wait for both database operations to complete
    await  Promise.all([
        ApprovedAppointment.findOneAndDelete({_id: appointmentId}).exec(),
        DeletedAppointment.findOneAndDelete({_id: appointmentId}).exec()
    ])
        .then(([approvedAppointment, deletedAppointment]) => {
            // send success response to client
            res.json({success: true});
            console.log('Deleted approved appointment:', approvedAppointment);
            console.log('Deleted deleted appointment:', deletedAppointment);
        })
        .catch(err => {
            console.error(err);
            res.json({success: false, message: 'Error deleting appointment.'});
        });
});

//This route handles updating an appointment with new data. It expects various appointment data fields to be sent in the request body.
// The code extracts the data from the request body.
// It uses Appointment.findOneAndUpdate() to find and update the appointment with the specified ID.
// After successful update, it logs the updated appointment and redirects to the "book-appointment" page.
// If there is an error, it sends a server error response.
app.post("/update-appointment", async (req, res) => {
    try {
        // Extract data from the request body
        const appointmentId = req.body.appointmentID;
        const idNumber = req.body.idNumber;
        const fName = req.body.fName;
        const lName = req.body.lName;
        const tel = req.body.tel;
        const service = req.body.service;
        const date = req.body.date;
        const time = req.body.time;

        // Update the appointment with the new data
        const updatedAppointment = await Appointment.findOneAndUpdate(
            { _id: appointmentId },
            {
                idNumber: idNumber,
                fName: fName,
                lName: lName,
                tel: tel,
                service: service,
                date: date,
                time: time,
            },
            { new: true }
        ).exec();

        console.log(updatedAppointment);

        // Redirect to the book-appointment page
        res.redirect("/book-appointment");
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles approving an appointment. It expects various appointment data fields to be sent in the request body.
// The code extracts the data from the request body.
// It updates the patient's information using Patient.findOneAndUpdate().
// It creates a new approved appointment using the ApprovedAppointment model and saves it.
// It deletes the original appointment using Appointment.deleteOne().
// After successful approval, it logs a success message and redirects to the "book-appointment" page.
// If there is an error, it sends a server error response.
app.post("/approve-appointment", async (req, res) => {
    try {
        // Extract data from the request body
        const appointmentId = req.body.appointmentID;
        const idNumber = req.body.idNumber;
        const fName = req.body.fName;
        const lName = req.body.lName;
        const tel = req.body.tel;
        const service = req.body.service;
        const date = req.body.date;
        const time = req.body.time;
        const gender = req.body.gender;

        const filter = { idNumber: idNumber };
        const update = {
            $set: {
                fName: fName,
                lName: lName,
                disease: service,
                date: date,
                time: time,
                tel: tel,
                gender: gender,
                status: "Pending",
            },
        };
        const options = { upsert: true, new: true };

        // Update the patient information
        await Patient.findOneAndUpdate(filter, update, options).exec();

        // Create a new approved appointment
        const approvedAppointment = new ApprovedAppointment({
            idNumber: idNumber,
            fName: fName,
            lName: lName,
            service: service,
            date: date,
            time: time,
            tel: tel,
        });
        await approvedAppointment.save();

        // Delete the original appointment
        await Appointment.deleteOne({ _id: appointmentId }).exec();

        console.log("Document approved successfully.");

        // Redirect to the book-appointment page
        res.redirect("/book-appointment");
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

//This route handles updating clinic information. It expects clinic data fields to be sent in the request body.
// The code extracts the clinic data from the request body.
// It finds an existing clinic document with a different ID number and deletes it using existingClinic.remove().
// It creates a new clinic document with the updated clinic data using Clinic.create().
// After successful update, it redirects to the "account-settings" page.
// If there is an error, it sends a server error response.
app.post('/clinic-info', async (req, res) => {
    // Extract clinic data from the request body
    const clinicData = {
        idNumber: req.body.idNumber,
        name: req.body.clinicName,
        address: req.body.clinicAddress,
        city: req.body.city,
        state: req.body.state,
        phone: req.body.clinicPhone,
        email: req.body.clinicEmail,
        clinicType: req.body.clinicType,
        clinicMessage: req.body.clinicMessage,
        // clinicLogo: req.file.path
    };

    try {
        // Find the existing clinic document
        const existingClinic = await Clinic.findOne({ idNumber: { $ne: clinicData.idNumber } }).exec();

        if (existingClinic) {
            await existingClinic.remove(); // Delete any existing clinic document with a different idNumber
        }

        // Create a new clinic document with the clinicData
        await Clinic.create(clinicData);

        // Redirect to the account-settings page
        res.redirect("/account-settings");
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).send('Internal Server Error');
    }
});

//This route handles updating doctor information. It expects doctor data fields to be sent in the request body.
// The code extracts the doctor data from the request body.
// It updates the doctor information using Doctor.findOneAndUpdate().
// After successful update, it redirects to the "account-settings" page.
// If there is an error, it sends a server error response.
app.post('/doctor-info', async (req, res) => {
    // Extract doctor data from the request body
    const doctorData = {
        idNumber: req.body.idNumber,
        fName: req.body.fName,
        username: req.body.email,
        lName: req.body.lName,
        email: req.body.email,
        tel: req.body.tel,
        company: req.body.company,
        companyWebsite: req.body.companyWebsite,
        specialty: req.body.specialty,
        // doctorPhoto: req.file.path,
        experience: req.body.experience,
        address: {
            street: req.body.street,
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            timeZone: req.body.timeZone
        },
        schedule: req.body.schedule,
    };

    try {
        // Update the doctor information
        await Doctor.findOneAndUpdate(
            { _id: { $ne: null } }, // Check if there is any existing document
            doctorData, // Update with new doctor data
            { upsert: true, new: true, overwrite: true } // Create or update the existing document
        ).exec();

        // Redirect to the account-settings page
        res.redirect("/account-settings");
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).send('Internal Server Error');
    }
});

//This route handles updating social media settings. It expects social media data fields to be sent in the request body.
// The code extracts the social media data from the request body.
// It updates the social media settings using SettingSocialMedia.findOneAndUpdate().
// After successful update, it redirects to the "account-settings" page.
// If there is an error, it sends a server error response.
app.post('/social-media', async (req, res) => {
    // Extract social media data from the request body
    const socialMediaData = {
        twitter: req.body.twitter,
        facebook: req.body.facebook,
        linkedIn: req.body.linkedIn
    };

    try {
        // Update the social media settings
        await SettingSocialMedia.findOneAndUpdate(
            {}, // Empty filter to update any existing document
            { socialMedia: socialMediaData }, // Update the socialMedia field with the new data
            { upsert: true, new: true } // Create a new document if it doesn't exist
        ).exec();

        // Redirect to the account-settings page
        res.redirect("/account-settings");
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).send('Internal Server Error');
    }
});

//This route handles uploading a doctor's photo. It expects a single file with the field name doctorPhoto to be uploaded.
// The code creates a new DoctorPhoto document with the uploaded file's path and saves it.
// After successful upload, it redirects to the "account-settings" page.
app.post('/doctor-photos', upload.single('doctorPhoto'), function (req, res) {
    // Create a new doctor photo document
    const doctorPhoto = new DoctorPhoto({
        doctorPhoto: req.file.path
    });

    // Save the doctor photo document
    doctorPhoto.save();
    res.redirect("/account-settings");
});

//This route handles creating an invoice for a patient. It expects invoice data fields to be sent in the request body and the patient ID as a URL parameter.
// The code generates an invoice ID using the shortid library and extracts other invoice data from the request body.
// It creates an array of InvoiceItem documents based on the provided item data.
// It calculates the total price, amount paid, and due amount for the invoice.
// It creates a new Invoice document with the invoice data and adds it to the patient's invoices array using Patient.findByIdAndUpdate().
// After successful creation, it saves the invoice and redirects to the patient profile page with the updated patient information.
// If there is an error, it sends a server error response.
app.post('/patients/:id/invoices', async (req, res) => {
    try {
        // Generate an invoice ID using the shortid library
        const invoice_Id = `#${shortid.generate()}`;

        // Extract invoice data from the request body
        const fullName = req.body.fullName;
        const { items } = req.body;
        const patientId = req.params.id;
        const invoiceDate = req.body.invoiceDate;
        const email = req.body.email;
        const terms = req.body.terms;

        // Create an array of invoice items
        const invoiceItems = items.map(({ itemName, description, unitCost, quantity }) => {
            return new InvoiceItem({
                itemName: itemName,
                description: description,
                unitCost: unitCost,
                quantity: quantity,
            });
        });

        // Calculate the total price, amount paid, and due amount
        const amountPaid = req.body.amountPaid;
        const totalPrice = invoiceItems.reduce((acc, item) => acc + item.total, 0);
        const due = totalPrice - amountPaid;

        // Create a new invoice document
        const invoice = new Invoice({
            invoiceId: invoice_Id,
            fullName: fullName,
            status: due > 0 ? "Pending" : "Paid",
            invoiceDate: invoiceDate,
            items: invoiceItems,
            totalPrice: totalPrice,
            amountPaid: amountPaid,
            due: due,
            email: email,
            terms: terms,
        });

        // Add the invoice to the patient's invoices array and save the invoice
        await Patient.findByIdAndUpdate(
            patientId,
            { $push: { invoices: invoice } },
            { new: true }
        ).exec();

        await invoice.save();

        // Redirect to the patient profile page with updated patient information
        res.redirect('/patient-profile?id=' + patientId);
    } catch (error) {
        console.error(error);
        // Send a server error response
        res.status(500).send('Internal Server Error');
    }
});

// SSE Connections Array
const sseConnections = [];

// Send SSE event to all connected clients
function sendEvent(data) {
    const event = `data: ${data}\n\n`;

    // Send the SSE event to all connected clients
    sseConnections.forEach((res) => {
        res.write(event);
    });

    console.log(`Sent SSE event: ${event}`);
}

// SSE Route
app.get('/sse', (req, res) => {
    // Set the headers to enable SSE
    const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    };

    // Set the response headers
    res.writeHead(200, headers);

    // Save the response object so we can send SSE events to it later
    sseConnections.push(res);

    console.log('Client connected to SSE');

    // Send a welcome message
    const event = `data: Welcome to the SSE endpoint\n\n`;
    res.write(event);

    // Handle the SSE connection closing
    req.on('close', () => {
        console.log('Client disconnected from SSE');
        // Remove the connection from the connections array
        const index = sseConnections.indexOf(res);
        if (index >= 0) {
            sseConnections.splice(index, 1);
        }
    });
});

//This route is triggered when a POST request is made to /generate-pdf.
// It expects the request body to contain invoID and patientID.
// The route retrieves the corresponding invoice and patient information from the database using the provided IDs.
// It also fetches a doctor's information using Doctor.findOne().
// The patient's first and last names are masked by replacing all but the first two characters with asterisks.
// The invoice data is then formatted and organized.
// The createInvoice function is called to generate a PDF document using the PDFDocument module.
// The generated PDF is converted to a base64 string and attached as an email attachment.
// An email is sent to the patient's email address with the PDF attachment using sgMail.send().
// If successful, it logs a success message and calls the sendEvent() function.
// If an error occurs during the process, it logs the error and an error message.
app.post('/generate-pdf', async (req, res) => {
    try {
        const invoiceId = req.body.invoID;
        const patientId = req.body.patientID;
        const inv = await Invoice.findById(invoiceId);
        const pat = await Patient.findById(patientId);
        const doctor = await Doctor.findOne();
        const fName = pat.fName;
        const lName = pat.lName;
        const maskedFName = fName.substring(0, 2) + '*'.repeat(fName.length - 2);
        const maskedLName = lName.substring(0, 2) + '*'.repeat(lName.length - 2);
        const maskedName = `${maskedFName} ${maskedLName}`;

        // console.log(inv)

        if (!inv) {
            res.status(404).send('Invoice not found');
            return;
        }

        const invoice = {
            shipping: {
                name: maskedName,
            },
            items: inv.items.map(item => ({
                item: item.itemName,
                description: item.description,
                quantity: item.quantity,
                amount: item.unitCost
            })),
            subtotal: inv.totalPrice,
            paid: inv.amountPaid,
            invoice_nr: inv.invoiceId,
        };

        function createInvoice(invoice) {
            const doc = new PDFDocument({size: "A4", margin: 50});

            generateHeader(doc);
            generateCustomerInformation(doc, invoice);
            generateInvoiceTable(doc, invoice);
            generateFooter(doc);

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);

                const attachment = {
                    content: pdfData.toString('base64'),
                    filename: 'invoice.pdf',
                    type: 'application/pdf',
                    disposition: 'attachment'
                };

                const msg = {
                    to: pat.email,
                    from: "roma7nce@hotmail.com",
                    subject: 'Invoice',
                    text: 'Please find the attached invoice.',
                    attachments: [attachment]
                };

                sgMail.send(msg)
                    .then(() => {
                        console.log('PDF generated and sent successfully');
                        sendEvent();
                    })
                    .catch((err) => {
                        console.log(err);
                        console.log('Error sending email');

                    });
            });

            // doc.pipe(res);
            doc.end();
        }

        function generateHeader(doc) {
            doc
                .image("logo.png", 50, 45, {width: 50})
                .fillColor("#444444")
                .fontSize(20)
                .text("ACME Inc.", 110, 57)
                .fontSize(10)
                .text("ACME Inc.", 200, 50, {align: "right"})
                .text(`${doctor.address.state}, ${doctor.address.street}`, 200, 65, {align: "right"})
                .text(`${doctor.address.city}, ${doctor.address.country}, ${doctor.address.zipCode}`, 200, 80, {align: "right"})
                .moveDown();
        }

        function generateCustomerInformation(doc, invoice) {
            doc
                .fillColor("#444444")
                .fontSize(20)
                .text("Invoice", 50, 160);

            generateHr(doc, 185);

            const customerInformationTop = 200;

            doc
                .fontSize(10)
                .text("Invoice Number:", 50, customerInformationTop)
                .font("Helvetica-Bold")
                .text(invoice.invoice_nr, 150, customerInformationTop)
                .font("Helvetica")
                .text("Invoice Date:", 50, customerInformationTop + 15)
                .text(formatDate(inv.invoiceDate), 150, customerInformationTop + 15)
                .text("Total:", 50, customerInformationTop + 30)
                .text(
                    (inv.totalPrice),
                    150,
                    customerInformationTop + 30
                )

                .font("Helvetica-Bold")
                .text(invoice.shipping.name, 300, customerInformationTop)
                .font("Helvetica")
                .moveDown();

            generateHr(doc, 252);
        }

        function generateInvoiceTable(doc, invoice) {
            let i;
            const invoiceTableTop = 330;

            doc.font("Helvetica-Bold");
            generateTableRow(
                doc,
                invoiceTableTop,
                "Item",
                "Description",
                "Unit Cost",
                "Quantity",
                "Line Total"
            );
            generateHr(doc, invoiceTableTop + 20);
            doc.font("Helvetica");

            for (i = 0; i < invoice.items.length; i++) {
                const item = invoice.items[i];
                const position = invoiceTableTop + (i + 1) * 30;
                generateTableRow(
                    doc,
                    position,
                    item.item,
                    item.description,
                    item.amount,
                    item.quantity,
                    (item.amount * item.quantity)
                );

                generateHr(doc, position + 20);
            }

            const subtotalPosition = invoiceTableTop + (i + 1) * 30;
            generateTableRow(
                doc,
                subtotalPosition,
                "",
                "",
                "Subtotal",
                "",
                inv.totalPrice
            );

            const paidToDatePosition = subtotalPosition + 20;
            generateTableRow(
                doc,
                paidToDatePosition,
                "",
                "",
                "Paid To Date",
                "",
                (inv.amountPaid)
            );

            const duePosition = paidToDatePosition + 25;
            doc.font("Helvetica-Bold");
            generateTableRow(
                doc,
                duePosition,
                "",
                "",
                "Balance Due",
                "",
                (inv.totalPrice - inv.amountPaid)
            );
            doc.font("Helvetica");
        }

        function generateFooter(doc) {
            doc
                .fontSize(10)
                .text(
                    inv.terms,
                    50,
                    780,
                    {align: "center", width: 500}
                );
        }

        function generateTableRow(
            doc,
            y,
            item,
            description,
            unitCost,
            quantity,
            lineTotal
        ) {
            doc
                .fontSize(10)
                .text(item, 50, y)
                .text(description, 150, y)
                .text(unitCost, 280, y, {width: 90, align: "right"})
                .text(quantity, 370, y, {width: 90, align: "right"})
                .text(lineTotal, 0, y, {align: "right"});
        }

        function generateHr(doc, y) {
            doc
                .strokeColor("#aaaaaa")
                .lineWidth(1)
                .moveTo(50, y)
                .lineTo(550, y)
                .stroke();
        }

        function formatCurrency(cents) {
            return "$" + (cents / 100).toFixed(2);
        }

        function formatDate(date) {
            return date;
        }

        createInvoice(invoice, "invoice.pdf");
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

//This route is triggered when a POST request is made to /download-pdf.
// It expects the request body to contain invoID and patientID.
// The route retrieves the corresponding invoice and patient information from the database using the provided IDs.
// It also fetches a doctor's information using Doctor.findOne().
// The patient's first and last names are masked by replacing all but the first two characters with asterisks.
// The invoice data is then formatted and organized.
// The createInvoice function is called to generate a PDF document using the PDFDocument module.
// The generated PDF is streamed as a response to the client.
// The response headers are set to specify the content as a PDF file and provide the file name.
app.post('/download-pdf', async (req, res) => {
    try {
        const invoiceId = req.body.invoID;
        const patientId = req.body.patientID;
        const inv = await Invoice.findById(invoiceId);
        const pat = await Patient.findById(patientId);
        const doctor = await Doctor.findOne();
        const fName = pat.fName;
        const lName = pat.lName;
        const maskedFName = fName.substring(0, 2) + '*'.repeat(fName.length - 2);
        const maskedLName = lName.substring(0, 2) + '*'.repeat(lName.length - 2);
        const maskedName = `${maskedFName} ${maskedLName}`;

        // console.log(inv)

        if (!inv) {
            res.status(404).send('Invoice not found');
            return;
        }

        const invoice = {
            shipping: {
                name: maskedName,
            },
            items: inv.items.map(item => ({
                item: item.itemName,
                description: item.description,
                quantity: item.quantity,
                amount: item.unitCost
            })),
            subtotal: inv.totalPrice,
            paid: inv.amountPaid,
            invoice_nr: inv.invoiceId,
        };

        function createInvoice(invoice) {
            const doc = new PDFDocument({size: "A4", margin: 50});

            generateHeader(doc);
            generateCustomerInformation(doc, invoice);
            generateInvoiceTable(doc, invoice);
            generateFooter(doc);

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);

            });
            res.setHeader("Content-Disposition", `attachment; filename=invoice.pdf`);
            res.setHeader("Content-Type", "application/pdf");

            // Write the PDF data to the response object
            doc.pipe(res);

            doc.end();
        }

        function generateHeader(doc) {
            doc
                .image("logo.png", 50, 45, {width: 50})
                .fillColor("#444444")
                .fontSize(20)
                .text("ACME Inc.", 110, 57)
                .fontSize(10)
                .text("ACME Inc.", 200, 50, {align: "right"})
                .text(`${doctor.address.state}, ${doctor.address.street}`, 200, 65, {align: "right"})
                .text(`${doctor.address.city}, ${doctor.address.country}, ${doctor.address.zipCode}`, 200, 80, {align: "right"})
                .moveDown();
        }

        function generateCustomerInformation(doc, invoice) {
            doc
                .fillColor("#444444")
                .fontSize(20)
                .text("Invoice", 50, 160);

            generateHr(doc, 185);

            const customerInformationTop = 200;

            doc
                .fontSize(10)
                .text("Invoice Number:", 50, customerInformationTop)
                .font("Helvetica-Bold")
                .text(invoice.invoice_nr, 150, customerInformationTop)
                .font("Helvetica")
                .text("Invoice Date:", 50, customerInformationTop + 15)
                .text(formatDate(inv.invoiceDate), 150, customerInformationTop + 15)
                .text("Total:", 50, customerInformationTop + 30)
                .text(
                    (inv.totalPrice),
                    150,
                    customerInformationTop + 30
                )

                .font("Helvetica-Bold")
                .text(invoice.shipping.name, 300, customerInformationTop)
                .font("Helvetica")
                .moveDown();

            generateHr(doc, 252);
        }

        function generateInvoiceTable(doc, invoice) {
            let i;
            const invoiceTableTop = 330;

            doc.font("Helvetica-Bold");
            generateTableRow(
                doc,
                invoiceTableTop,
                "Item",
                "Description",
                "Unit Cost",
                "Quantity",
                "Line Total"
            );
            generateHr(doc, invoiceTableTop + 20);
            doc.font("Helvetica");

            for (i = 0; i < invoice.items.length; i++) {
                const item = invoice.items[i];
                const position = invoiceTableTop + (i + 1) * 30;
                generateTableRow(
                    doc,
                    position,
                    item.item,
                    item.description,
                    item.amount,
                    item.quantity,
                    (item.amount * item.quantity)
                );

                generateHr(doc, position + 20);
            }

            const subtotalPosition = invoiceTableTop + (i + 1) * 30;
            generateTableRow(
                doc,
                subtotalPosition,
                "",
                "",
                "Subtotal",
                "",
                inv.totalPrice
            );

            const paidToDatePosition = subtotalPosition + 20;
            generateTableRow(
                doc,
                paidToDatePosition,
                "",
                "",
                "Paid To Date",
                "",
                (inv.amountPaid)
            );

            const duePosition = paidToDatePosition + 25;
            doc.font("Helvetica-Bold");
            generateTableRow(
                doc,
                duePosition,
                "",
                "",
                "Balance Due",
                "",
                (inv.totalPrice - inv.amountPaid)
            );
            doc.font("Helvetica");
        }

        function generateFooter(doc) {
            doc
                .fontSize(10)
                .text(
                    inv.terms,
                    50,
                    780,
                    {align: "center", width: 500}
                );
        }

        function generateTableRow(
            doc,
            y,
            item,
            description,
            unitCost,
            quantity,
            lineTotal
        ) {
            doc
                .fontSize(10)
                .text(item, 50, y)
                .text(description, 150, y)
                .text(unitCost, 280, y, {width: 90, align: "right"})
                .text(quantity, 370, y, {width: 90, align: "right"})
                .text(lineTotal, 0, y, {align: "right"});
        }

        function generateHr(doc, y) {
            doc
                .strokeColor("#aaaaaa")
                .lineWidth(1)
                .moveTo(50, y)
                .lineTo(550, y)
                .stroke();
        }

        function formatCurrency(cents) {
            return "$" + (cents / 100).toFixed(2);
        }

        function formatDate(date) {
            return date;
        }

        createInvoice(invoice, "invoice.pdf");
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
    }
});

// This route handler handles a POST request for updating the theme value in user preferences. It retrieves the current user preferences from the database, checks if the new theme value is different from the current one, and updates the theme value in the user preferences. Finally, it sends a JSON response with the updated preferences.
app.post('/update-theme', async (req, res) => {
    try {
        const { themeValue } = req.body;

        // Fetch the current user preferences from the database
        const currentPrefs = await UserPreferences.findOne({});
        const currentThemeValue = currentPrefs ? currentPrefs.themeValue : null;

        // Check if the new theme value is the same as the current one
        if (currentThemeValue === themeValue) {
            res.json(currentThemeValue); // No change in theme value
            return;
        }

        // Update the theme value in the user preferences
        const updatedPrefs = await UserPreferences.findOneAndUpdate(
            {},
            {
                $set: {
                    themeValue: themeValue,
                }
            }, // Update 'themeValue'
            { new: true, upsert: true }
        );

        res.json(updatedPrefs);
        console.log(updatedPrefs)
        console.log(updatedPrefs.themeValue)
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//This route handler handles a POST request for updating the sidebarMini value in user preferences. It retrieves the current user preferences from the database and updates the sidebarMini value. Then, it sends a JSON response with the updated preferences.
app.post('/update-sidebar', async (req, res) => {
    const sidebarMini = req.body.sidebarMini === 'true';
    try {
        // Update the sidebarMini value in the user preferences
        const updatedPrefs = await UserPreferences.findOneAndUpdate(
            {},
            {
                $set: {
                    sidebarMini: sidebarMini,
                }
            }, // Update 'sidebarMini'
            { new: true, upsert: true }
        );

        res.json(updatedPrefs);
        // console.log(updatedPrefs)
        // console.log(updatedPrefs.themeValue)
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//This route handler handles a POST request for updating various user preferences. It retrieves the submitted form data, including theme, themeValue, font, pic, and other preferences. It retrieves the current user preferences from the database and updates the preferences with the new values. Finally, it redirects to the "/dashboard" route.
app.post("/user-prefrences", async (req, res) => {
    const hMenu = req.body.h_menu === 'true';
    const themeRtl = req.body.themeRtl === 'true';
    const headerFixed = req.body.headerFixed === 'true';
    const headerDarkMode = req.body.headerDarkMode === 'true';
    const borderRadios = req.body.borderRadios === 'true';
    const sidebarDark = req.body.sidebarDark === 'true';
    const checkImage = req.body.checkImage === 'true';
    const fluidLayout = req.body.fluidLayout === 'true';
    const cardShadow = req.body.cardShadow === 'true';

    try {
        const {
            theme, themeValue, font, pic
        } = req.body;

        // Find the user preferences document and retrieve the current pic value
        const currentPrefs = await UserPreferences.findOne({});
        const currentPic = currentPrefs ? currentPrefs.pic : null;
        const currentThemeValue = currentPrefs ? currentPrefs.themeValue : null;

        // Check if the submitted form has a pic value, if not, use the currentPic value
        const updatedPic = pic ? pic : currentPic;
        const updatedThemeValue = themeValue ? themeValue : currentThemeValue;

        // Find the user preferences document and update it with the new values
        const updatedPrefs = await UserPreferences.findOneAndUpdate(
            {}, // Find any document
            {
                $set: {
                    theme,
                    themeValue: updatedThemeValue,
                    themeRtl,
                    font,
                    h_menu: hMenu,
                    headerFixed,
                    headerDarkMode,
                    borderRadios,
                    sidebarDark,
                    checkImage,
                    fluidLayout,
                    pic: updatedPic,
                    cardShadow,
                },
            },
            { new: true, upsert: true }, // Return the updated document or create a new one if none exist
        );

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const reviewEmitter = new EventEmitter();

// This route handler handles a POST request for submitting a review. It retrieves the review data from the request body, creates a new Review object, saves it to the database, and emits an SSE event with the saved review. It sends a JSON response indicating the success of the operation.
app.post("/rate", async (req, res) => {
    try {
        const formData = req.body.formData;
        console.log(formData);
        const rating = formData.rating;
        const name = formData.name;
        const profession = formData.profession;
        const city = formData.city;
        const review = formData.review;

        const newReview = new Review({
            rating: rating,
            name: name,
            profession: profession,
            city: city,
            review: review,
        });

        const savedReview = await newReview.save();

        console.log('Review saved:', savedReview);

        // Emit an SSE event with the saved review
        reviewEmitter.emit('newReview', savedReview);

        // Send a JSON response indicating success
        res.status(200).json({ message: 'Review saved successfully' });
    } catch (error) {
        console.error('Error saving review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// This route handler establishes a Server-Sent Events (SSE) connection for receiving new reviews. It sets the appropriate headers for SSE, registers an event listener for 'newReview' events, and sends the new review data to the client as an SSE event. It also removes the event listener when the client closes the SSE connection.
app.get('/sse/reviews', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = (newReview) => {
        // Send the new review to the client as an SSE event
        res.write(`data: ${JSON.stringify(newReview)}\n\n`);
    };

    // Listen for 'newReview' events
    reviewEmitter.on('newReview', listener);

    // Remove the listener when the client closes the SSE connection
    req.on('close', () => {
        reviewEmitter.off('newReview', listener);
    });
});

//  This route handler handles a POST request for saving contact information. It retrieves the contact form data from the request body, creates a new Contact object, saves it to the database, and emits an SSE event with the saved contact. Finally, it sends a JSON response indicating the success of the operation.
app.post("/contact", async (req, res) => {
    try {
        const formData = req.body.formData;
        const name = formData.name;
        const email = formData.email;
        const tel = formData.tel;
        const message = formData.message;

        const newContact = new Contact({
            name: name,
            email: email,
            tel: tel,
            message: message,
        });

        const savedContact = await newContact.save();

        // Emit an SSE event with the saved contact
        contactEmitter.emit('newContact', savedContact);

        // Send a JSON response indicating success
        res.status(200).json({message: 'Contact saved successfully'});
    } catch (error) {
        console.error('Error saving contact:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

//  This route handler establishes an SSE connection for receiving new contact information. It sets the appropriate headers for SSE, registers an event listener for 'newContact' events, and sends the new contact data to the client as an SSE event. It also removes the event listener when the client closes the SSE connection.
app.get('/sse/contacts', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = (newContact) => {
        // Send the new contact to the client as an SSE event
        res.write(`data: ${JSON.stringify(newContact)}\n\n`);
    };

    // Listen for 'newContact' events
    contactEmitter.on('newContact', listener);

    // Remove the listener when the client closes the SSE connection
    req.on('close', () => {
        contactEmitter.off('newContact', listener);
    });
});

// This route handler handles a POST request for updating the last visit of a patient. It retrieves the last visit form data from the request body, finds the patient by the provided ID, adds the last visit information to the patient's lastVisit array, saves the patient, and saves the last visit information to the database as a new LastVisit object. Finally, it sends a JSON response indicating the success of the operation.
app.post('/patients/:id/lastvisit', async (req, res) => {
    try {
        const formData = req.body.formData;
        console.log(formData);

        const patientId = req.params.id;
        const { reason, date, time, note } = formData;

        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).send("Patient not found");
        }

        const lastVisit = {
            patientId,
            date,
            time,
            note,
            reason
        };

        patient.lastVisit.push(lastVisit);
        await patient.save();

        const newLastVisit = new LastVisit(lastVisit);
        await newLastVisit.save();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update last visit' });
    }
});


//The app.listen() function is used to start the server and make it listen on a specific port for incoming HTTP requests.
// connectDB()
app.listen(3000, function () {
    console.log("Server started on port 3000");
});
