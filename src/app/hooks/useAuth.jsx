import React, { useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import axios from "axios";
import userService from "../services/user.service";
import localStorageService, {
    setTokens
} from "../services/localStorage.service";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";

export const httpAuth = axios.create({
    baseURL: "https://identitytoolkit.googleapis.com/v1/",
    params: {
        key: process.env.REACT_APP_FIREBASE_KEY
    }
});

const AuthContext = React.createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

const AuthProvider = ({ children }) => {
    const [currentUser, setUser] = useState();
    const [error, setError] = useState(null);
    const [isLoading, setLoading] = useState(true);
    const history = useHistory();

    function logOut() {
        localStorageService.removeAuthData();
        setUser(null);
        history.push("/");
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    async function signUp({ email, password, ...rest }) {
        try {
            const { data } = await httpAuth.post(`accounts:signUp`, {
                email,
                password,
                returnSecureToken: true
            });
            setTokens(data);
            await createUser({
                _id: data.localId,
                email,
                rate: randomInt(1, 5),
                completedMeetings: randomInt(0, 200),
                image: `https://avatars.dicebear.com/api/avataaars/${(
                    Math.random() + 1
                )
                    .toString(36)
                    .substring(7)}.svg`,
                ...rest
            });
        } catch (error) {
            errorCatcher(error);
            const { code, message } = error.response.data.error;
            console.log(code, message);
            if (code === 400) {
                if (message === "EMAIL_EXISTS") {
                    const errorObject = {
                        email: "Пользователь с таким Email уже существует"
                    };
                    throw errorObject;
                }
            }
            // throw new Error
        }
    }

    async function signIn({ email, password }) {
        try {
            const { data } = await httpAuth.post(
                `accounts:signInWithPassword`,
                {
                    email,
                    password,
                    returnSecureToken: true
                }
            );
            setTokens(data);
            await getUserData();
            // return data;
        } catch (error) {
            errorCatcher(error);
            const { code, message } = error.response.data.error;
            console.log(code, message);
            if (code === 400) {
                switch (message) {
                    case "INVALID_PASSWORD":
                        throw new Error("Email или пароль введены некорректно");
                    default:
                        throw new Error(
                            "Слишком много попыток входа. Попробуйте позже"
                        );
                }
            }
            throw error;
        }
    }

    async function createUser(data) {
        try {
            const { content } = await userService.create(data);
            console.log("Created user data:", content);
            setUser(content);
        } catch (error) {
            errorCatcher(error);
        }
    }
    function errorCatcher(error) {
        // const { message } = error.response.data;
        // setError(message);
        const message =
            error.response && error.response.data
                ? error.response.data.message
                : error.message || "Произошла неизвестная ошибка";
        setError(message);
    }
    async function getUserData() {
        try {
            const { content } = await userService.getCurrentUser();
            setUser(content);
        } catch (error) {
            errorCatcher(error);
        } finally {
            setLoading(false);
        }
    }

    async function updateCurrentUser(data) {
        try {
            const response = await userService.create({
                ...data,
                _id: currentUser._id
            });
            if (response) {
                setUser(response);
                localStorageService.setAuthData(response);
                // toast.success("Профиль обновлен!");
            }
        } catch (error) {
            errorCatcher(error);
        }
    }

    useEffect(() => {
        if (localStorageService.getAccessToken()) {
            getUserData();
        } else {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (error !== null) {
            toast(error);
            setError(null);
        }
    }, [error]);

    return (
        <AuthContext.Provider
            value={{ signUp, signIn, currentUser, logOut, updateCurrentUser }}
        >
            {!isLoading ? children : "Loading..."}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.node),
        PropTypes.node
    ])
};

export default AuthProvider;
