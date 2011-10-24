from selenium import webdriver
from test_driver import Driver

browser = webdriver.Chrome()
d = Driver(browser)
d.go()
